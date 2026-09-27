import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";
import { heroImagePrompt } from "../lib/image";

const BodySchema = z.object({ force: z.boolean().optional() }).default({});

export const BUCKET = "hero-images";

/**
 * Storage path. The first folder is the brand id, which the Storage read policy checks. Each
 * generation gets its own file so a regenerated image is never served from a stale cache.
 */
export function heroImagePath(brandId: string, draftId: string, generation: string): string {
  return `${brandId}/${draftId}/${generation}.jpg`;
}

export const imageRoute = new Hono<AppContext>().post("/drafts/:id/image", async (c) => {
  const { db, images, imageDailyLimit } = c.get("deps");
  const id = c.req.param("id");
  const body = BodySchema.parse(await c.req.json().catch(() => ({})));

  const { data: draft, error } = await db
    .from("listing_drafts")
    .select(
      "id, brand_id, product_id, status, image_path, brand:brands(visual_notes), product:products(title, product_type)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("database", error.message);
  if (!draft) throw new AppError("draft_not_found", `draft ${id} not found`);

  const recorder = new StepRecorder(db, "image", {
    brand_id: draft.brand_id,
    product_id: draft.product_id,
    draft_id: draft.id,
  });

  if (draft.status !== "drafting" && draft.status !== "pending_review") {
    throw new AppError(
      "invalid_transition",
      `cannot add an image to a draft in status ${draft.status}`,
    );
  }
  if (draft.image_path && !body.force) {
    const result = {
      draft_id: draft.id,
      skipped: true as const,
      reason: "already_has_image",
      image_path: draft.image_path,
    };
    await recorder.finish("skipped", result);
    return c.json({ ...result, request_id: c.get("requestId") });
  }

  // Spend guard: a fixed number of generations per UTC day, counted from our own event log.
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await db
    .from("pipeline_events")
    .select("id", { count: "exact", head: true })
    .eq("step", "image")
    .eq("status", "ok")
    .gte("created_at", since.toISOString());
  if (countError) throw new AppError("database", countError.message);
  if ((count ?? 0) >= imageDailyLimit) {
    const result = {
      draft_id: draft.id,
      skipped: true as const,
      reason: "daily_limit_reached",
      limit: imageDailyLimit,
    };
    await recorder.finish("skipped", result);
    return c.json({ ...result, request_id: c.get("requestId") });
  }

  const prompt = heroImagePrompt(draft.product, draft.brand);
  let image;
  try {
    image = await images.generate(prompt);
  } catch (err) {
    await recorder.finish("error", { message: err instanceof Error ? err.message : String(err) });
    throw err;
  }

  const path = heroImagePath(draft.brand_id, draft.id, Date.now().toString(36));
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, image.bytes, { contentType: image.contentType, upsert: false });
  if (uploadError) {
    await recorder.finish("error", { message: uploadError.message });
    throw new AppError("storage_failed", uploadError.message);
  }

  const { error: updateError } = await db
    .from("listing_drafts")
    .update({ image_path: path, image_prompt: prompt })
    .eq("id", draft.id);
  if (updateError) throw new AppError("database", updateError.message);

  if (draft.image_path && draft.image_path !== path) {
    // The replaced image is no longer referenced; a failed delete only leaves an orphan file.
    const { error: removeError } = await db.storage.from(BUCKET).remove([draft.image_path]);
    if (removeError)
      console.error(
        JSON.stringify({ message: "old image not removed", error: removeError.message }),
      );
  }

  await recorder.finish("ok", { model: image.model, bytes: image.bytes.byteLength });
  return c.json({
    draft_id: draft.id,
    image_path: path,
    model: image.model,
    request_id: c.get("requestId"),
  });
});
