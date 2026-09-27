import { ListingContentSchema } from "@draft/shared";
import { Hono } from "hono";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";
import { getAccessToken } from "../lib/shopify";
import { syncHeroImage } from "../lib/shopify-media";

/**
 * Attach the hero image of an approved or published draft to its Shopify product, without
 * touching the listing text. Used for drafts published before image sync existed, and after
 * regenerating an image. Safe to repeat: an image that is already attached is skipped.
 */
export const publishImageRoute = new Hono<AppContext>().post(
  "/drafts/:id/publish/image",
  async (c) => {
    const { db, shopify, fetchImpl } = c.get("deps");
    const id = c.req.param("id");

    const { data: draft, error } = await db
      .from("listing_drafts")
      .select(
        "id, brand_id, product_id, status, content, image_path, shopify_media_id, shopify_media_path, brand:brands(id, shopify_domain), product:products(shopify_gid)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AppError("database", error.message);
    if (!draft) throw new AppError("draft_not_found", `draft ${id} not found`);
    if (draft.status !== "approved" && draft.status !== "published") {
      throw new AppError(
        "invalid_transition",
        `only approved or published drafts reach the store, this one is ${draft.status}`,
      );
    }
    const content = ListingContentSchema.safeParse(draft.content);
    if (!content.success) throw new AppError("validation", "draft content is not a valid listing");

    const recorder = new StepRecorder(db, "publish.image", {
      brand_id: draft.brand_id,
      product_id: draft.product_id,
      draft_id: draft.id,
    });
    try {
      const token = await getAccessToken(db, draft.brand, shopify, fetchImpl);
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
          alt: content.data.title,
        },
      });
      await recorder.finish(result.action === "upload" ? "ok" : "skipped", result);
      return c.json({ draft_id: draft.id, ...result, request_id: c.get("requestId") });
    } catch (err) {
      await recorder.finish("error", { message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },
);
