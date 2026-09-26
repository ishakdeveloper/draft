import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";

const BodySchema = z.object({ force: z.boolean().optional() }).default({});

export const generateRoute = new Hono<AppContext>().post("/drafts/:id/generate", async (c) => {
  const { db, generator } = c.get("deps");
  const id = c.req.param("id");
  const body = BodySchema.parse(await c.req.json().catch(() => ({})));

  const { data: draft, error } = await db
    .from("listing_drafts")
    .select(
      "id, brand_id, product_id, status, content, brand:brands(name, tone_guide, default_locale), product:products(title, body_html, product_type, tags)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("database", error.message);
  if (!draft) throw new AppError("draft_not_found", `draft ${id} not found`);

  const recorder = new StepRecorder(db, "generate", {
    brand_id: draft.brand_id,
    product_id: draft.product_id,
    draft_id: draft.id,
  });

  if (draft.status !== "drafting" && draft.status !== "pending_review") {
    throw new AppError(
      "invalid_transition",
      `cannot generate for a draft in status ${draft.status}`,
    );
  }
  if (draft.content && !body.force) {
    const result = {
      draft_id: draft.id,
      status: draft.status,
      skipped: true as const,
      reason: "already_generated",
    };
    await recorder.finish("skipped", result);
    return c.json({ ...result, request_id: c.get("requestId") });
  }

  let generated;
  try {
    generated = await generator.generate(draft.brand, {
      title: draft.product.title,
      body_html: draft.product.body_html,
      product_type: draft.product.product_type,
      tags: draft.product.tags,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recorder.finish("error", { message });
    throw err;
  }

  const { error: updateError } = await db
    .from("listing_drafts")
    .update({
      content: generated.content,
      model: generated.model,
      error: null,
      ...(draft.status === "drafting" && { status: "pending_review" as const }),
    })
    .eq("id", draft.id);
  if (updateError) {
    await recorder.finish("error", { message: updateError.message });
    throw new AppError("database", updateError.message);
  }

  await recorder.finish("ok", { model: generated.model, usage: generated.usage });
  return c.json({
    draft_id: draft.id,
    status: "pending_review",
    content: generated.content,
    model: generated.model,
    request_id: c.get("requestId"),
  });
});
