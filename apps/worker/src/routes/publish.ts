import { contentHash, ListingContentSchema } from "@draft/shared";
import { Hono } from "hono";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";
import { PRODUCT_UPDATE, getAccessToken, shopifyGraphql } from "../lib/shopify";

interface ProductUpdateData {
  productUpdate: {
    product: { id: string; title: string; updatedAt: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

/**
 * Writes an approved draft to Shopify and marks it published. The publish_hash is stored
 * before the Shopify call, so the products/update webhook our own write triggers is
 * recognised as an echo and skipped. Safe to retry: the same content is written again.
 */
export const publishRoute = new Hono<AppContext>().post("/drafts/:id/publish", async (c) => {
  const { db, shopify, fetchImpl } = c.get("deps");
  const id = c.req.param("id");

  const { data: draft, error } = await db
    .from("listing_drafts")
    .select(
      "id, brand_id, product_id, status, content, brand:brands(id, shopify_domain), product:products(shopify_gid)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("database", error.message);
  if (!draft) throw new AppError("draft_not_found", `draft ${id} not found`);

  const recorder = new StepRecorder(db, "publish", {
    brand_id: draft.brand_id,
    product_id: draft.product_id,
    draft_id: draft.id,
  });

  if (draft.status === "published") {
    await recorder.finish("skipped", { reason: "already_published" });
    return c.json({
      draft_id: draft.id,
      status: "published",
      skipped: true,
      request_id: c.get("requestId"),
    });
  }
  if (draft.status !== "approved") {
    throw new AppError(
      "invalid_transition",
      `only approved drafts are published, this one is ${draft.status}`,
    );
  }
  const parsed = ListingContentSchema.safeParse(draft.content);
  if (!parsed.success)
    throw new AppError("validation", "draft content is not a valid listing", parsed.error.issues);
  const content = parsed.data;

  const publishHash = await contentHash(content.title, content.description_html);
  const { error: hashError } = await db
    .from("listing_drafts")
    .update({ publish_hash: publishHash })
    .eq("id", draft.id);
  if (hashError) throw new AppError("database", hashError.message);

  try {
    const token = await getAccessToken(db, draft.brand, shopify, fetchImpl);
    const { data, apiVersion } = await shopifyGraphql<ProductUpdateData>(
      draft.brand.shopify_domain,
      token,
      shopify.apiVersion,
      PRODUCT_UPDATE,
      {
        product: {
          id: draft.product.shopify_gid,
          title: content.title,
          descriptionHtml: content.description_html,
          seo: { title: content.seo_title, description: content.seo_description },
        },
      },
      fetchImpl,
    );
    const userErrors = data.productUpdate.userErrors;
    if (userErrors.length > 0 || !data.productUpdate.product) {
      throw new AppError(
        "shopify_failed",
        userErrors.map((e) => e.message).join("; ") || "no product returned",
        userErrors,
      );
    }

    const { error: doneError } = await db
      .from("listing_drafts")
      .update({ status: "published" })
      .eq("id", draft.id);
    if (doneError) throw new AppError("database", doneError.message);

    await recorder.finish("ok", {
      shopify_updated_at: data.productUpdate.product.updatedAt,
      api_version: apiVersion,
    });
    return c.json({
      draft_id: draft.id,
      status: "published",
      product_id: data.productUpdate.product.id,
      request_id: c.get("requestId"),
    });
  } catch (err) {
    await recorder.finish("error", { message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
});
