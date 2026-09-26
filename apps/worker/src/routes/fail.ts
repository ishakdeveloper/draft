import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";
import type { Json } from "@draft/shared/database";

const BodySchema = z.object({
  step: z.string().min(1),
  message: z.string().min(1),
  detail: z.unknown().optional(),
});

/** Called by the orchestrator when a step gave up. Moves an in-flight draft to failed; otherwise only records. */
export const failRoute = new Hono<AppContext>().post("/drafts/:id/fail", async (c) => {
  const { db } = c.get("deps");
  const id = c.req.param("id");
  const parsed = BodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation", "invalid fail body", parsed.error.issues);
  const { step, message, detail } = parsed.data;

  const { data: draft, error } = await db
    .from("listing_drafts")
    .select("id, brand_id, product_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("database", error.message);
  if (!draft) throw new AppError("draft_not_found", `draft ${id} not found`);

  const recorder = new StepRecorder(db, "fail", {
    brand_id: draft.brand_id,
    product_id: draft.product_id,
    draft_id: draft.id,
  });
  const errorRecord = {
    step,
    message,
    detail: (detail ?? null) as Json,
    at: new Date().toISOString(),
  };

  let status = draft.status;
  if (draft.status === "drafting" || draft.status === "approved") {
    const { error: updateError } = await db
      .from("listing_drafts")
      .update({ status: "failed", error: errorRecord })
      .eq("id", draft.id);
    if (updateError) throw new AppError("database", updateError.message);
    status = "failed";
  }

  await recorder.finish("error", { ...errorRecord, previous_status: draft.status, status });
  return c.json({ draft_id: draft.id, status, request_id: c.get("requestId") });
});
