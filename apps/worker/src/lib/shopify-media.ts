import { AppError } from "./errors";
import type { FetchLike, ShopifySettings } from "./shopify";
import { shopifyGraphql } from "./shopify";
import type { Db } from "./supabase";

const BUCKET = "hero-images";
const SIGNED_URL_SECONDS = 15 * 60;

export const PRODUCT_MEDIA_QUERY = /* GraphQL */ `
  query DraftProductMedia($id: ID!) {
    product(id: $id) {
      media(first: 100) {
        nodes {
          id
        }
      }
    }
  }
`;

export const PRODUCT_ADD_MEDIA = /* GraphQL */ `
  mutation DraftAddMedia($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
    productUpdate(product: $product, media: $media) {
      product {
        media(first: 100) {
          nodes {
            id
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const FILE_DELETE = /* GraphQL */ `
  mutation DraftDeleteMedia($ids: [ID!]!) {
    fileDelete(fileIds: $ids) {
      deletedFileIds
      userErrors {
        field
        message
      }
    }
  }
`;

/** The media id that appeared on the product after the upload. */
export function pickNewMediaId(before: readonly string[], after: readonly string[]): string | null {
  const known = new Set(before);
  return after.find((id) => !known.has(id)) ?? null;
}

export type HeroSyncDecision = "none" | "unchanged" | "upload";

/** Upload only when there is an image and it is not the one already attached. */
export function heroSyncDecision(
  imagePath: string | null,
  attachedPath: string | null,
): HeroSyncDecision {
  if (!imagePath) return "none";
  return imagePath === attachedPath ? "unchanged" : "upload";
}

export interface HeroSyncInput {
  db: Db;
  shopify: ShopifySettings;
  fetchImpl: FetchLike;
  token: string;
  shop: string;
  draft: {
    id: string;
    image_path: string | null;
    shopify_media_id: string | null;
    shopify_media_path: string | null;
    product_gid: string;
    alt: string;
  };
}

export interface HeroSyncResult {
  action: HeroSyncDecision;
  media_id?: string | null;
  replaced?: string | null;
  /** Set when the previous image could not be removed; it stays on the product. */
  replace_error?: string;
  left_attached?: string | null;
}

/**
 * Attach the draft's hero image to the Shopify product. Shopify downloads it from a short-lived
 * signed URL, so the bucket stays private. A previously attached hero from this pipeline is
 * removed afterwards, so re-publishing never stacks copies.
 */
export async function syncHeroImage({
  db,
  shopify,
  fetchImpl,
  token,
  shop,
  draft,
}: HeroSyncInput): Promise<HeroSyncResult> {
  const action = heroSyncDecision(draft.image_path, draft.shopify_media_path);
  if (action !== "upload" || !draft.image_path) return { action };

  const { data: signed, error: signError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(draft.image_path, SIGNED_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    throw new AppError("storage_failed", signError?.message ?? "could not sign the image URL");
  }

  const { data: before } = await shopifyGraphql<{
    product: { media: { nodes: Array<{ id: string }> } } | null;
  }>(shop, token, shopify.apiVersion, PRODUCT_MEDIA_QUERY, { id: draft.product_gid }, fetchImpl);
  const beforeIds = before.product?.media.nodes.map((n) => n.id) ?? [];

  const { data: added } = await shopifyGraphql<{
    productUpdate: {
      product: { media: { nodes: Array<{ id: string }> } } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    shop,
    token,
    shopify.apiVersion,
    PRODUCT_ADD_MEDIA,
    {
      product: { id: draft.product_gid },
      media: [{ originalSource: signed.signedUrl, mediaContentType: "IMAGE", alt: draft.alt }],
    },
    fetchImpl,
  );
  const userErrors = added.productUpdate.userErrors;
  if (userErrors.length > 0) {
    throw new AppError("shopify_failed", userErrors.map((e) => e.message).join("; "), userErrors);
  }
  const mediaId = pickNewMediaId(
    beforeIds,
    added.productUpdate.product?.media.nodes.map((n) => n.id) ?? [],
  );

  // Record the new image before touching the old one: if anything below fails, a retry must
  // see this image as attached instead of uploading another copy.
  const { error: saveError } = await db
    .from("listing_drafts")
    .update({ shopify_media_id: mediaId, shopify_media_path: draft.image_path })
    .eq("id", draft.id);
  if (saveError) throw new AppError("database", saveError.message);

  let replaced: string | null = null;
  let replaceError: string | null = null;
  if (draft.shopify_media_id && draft.shopify_media_id !== mediaId) {
    try {
      const { data: deleted } = await shopifyGraphql<{
        fileDelete: { deletedFileIds: string[] | null; userErrors: Array<{ message: string }> };
      }>(
        shop,
        token,
        shopify.apiVersion,
        FILE_DELETE,
        { ids: [draft.shopify_media_id] },
        fetchImpl,
      );
      replaced = deleted.fileDelete.deletedFileIds?.[0] ?? null;
      if (deleted.fileDelete.userErrors.length > 0) {
        replaceError = deleted.fileDelete.userErrors.map((e) => e.message).join("; ");
      }
    } catch (err) {
      // Typically a missing write_files scope. The new image is live; the old one stays attached.
      replaceError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    action,
    media_id: mediaId,
    replaced,
    ...(replaceError ? { replace_error: replaceError, left_attached: draft.shopify_media_id } : {}),
  };
}
