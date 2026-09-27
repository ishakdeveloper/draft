import { contentHash, ListingContentSchema, TranslationsSchema } from "@draft/shared";
import { Hono } from "hono";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";
import { PRODUCT_UPDATE, getAccessToken, shopifyGraphql } from "../lib/shopify";
import { syncHeroImage } from "../lib/shopify-media";
import {
  TRANSLATABLE_QUERY,
  TRANSLATIONS_REGISTER,
  buildTranslationInputs,
  type TranslatableContent,
} from "../lib/shopify-translations";

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
      "id, brand_id, product_id, status, content, translations, image_path, shopify_media_id, shopify_media_path, brand:brands(id, shopify_domain), product:products(shopify_gid)",
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

    // Translations are best effort: the listing is already live, so a failure here is recorded
    // as its own step instead of failing the publish.
    const translations = TranslationsSchema.safeParse(draft.translations);
    if (translations.success && Object.keys(translations.data).length > 0) {
      const tRecorder = new StepRecorder(db, "publish.translations", {
        brand_id: draft.brand_id,
        product_id: draft.product_id,
        draft_id: draft.id,
      });
      try {
        const { data: tData } = await shopifyGraphql<{
          shopLocales: Array<{ locale: string }>;
          translatableResource: { translatableContent: TranslatableContent[] } | null;
        }>(
          draft.brand.shopify_domain,
          token,
          shopify.apiVersion,
          TRANSLATABLE_QUERY,
          { id: draft.product.shopify_gid },
          fetchImpl,
        );
        const { inputs, skippedLocales } = buildTranslationInputs(
          translations.data as Record<string, typeof content>,
          tData.translatableResource?.translatableContent ?? [],
          tData.shopLocales.map((l) => l.locale),
        );
        let registered = 0;
        let translationErrors: Array<{ message: string }> = [];
        if (inputs.length > 0) {
          const { data: rData } = await shopifyGraphql<{
            translationsRegister: {
              translations: unknown[] | null;
              userErrors: Array<{ message: string }>;
            };
          }>(
            draft.brand.shopify_domain,
            token,
            shopify.apiVersion,
            TRANSLATIONS_REGISTER,
            { id: draft.product.shopify_gid, translations: inputs },
            fetchImpl,
          );
          registered = rData.translationsRegister.translations?.length ?? 0;
          translationErrors = rData.translationsRegister.userErrors;
        }
        const detail = {
          registered,
          skipped_locales: skippedLocales,
          errors: translationErrors.map((e) => e.message),
        };
        const status = translationErrors.length > 0 ? "error" : registered === 0 ? "skipped" : "ok";
        await tRecorder.finish(status, detail);
      } catch (err) {
        await tRecorder.finish("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // The hero image is best effort too: recorded as its own step, never fails the publish.
    if (draft.image_path) {
      const iRecorder = new StepRecorder(db, "publish.image", {
        brand_id: draft.brand_id,
        product_id: draft.product_id,
        draft_id: draft.id,
      });
      try {
        const result = await syncHeroImage({
          db,
          shopify,
          fetchImpl,
          token,
          shop: draft.brand.shopify_domain,
          draft: {
            id: draft.id,
            image_path: draft.image_path,
            shopify_media_id: draft.shopify_media_id,
            shopify_media_path: draft.shopify_media_path,
            product_gid: draft.product.shopify_gid,
            alt: content.title,
          },
        });
        await iRecorder.finish(result.action === "upload" ? "ok" : "skipped", result);
      } catch (err) {
        await iRecorder.finish("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      }
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
