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

const DETAIL_KEYS = ["status", "code", "name", "message"] as const;

/**
 * Keep only a small allowlist of the caller's error detail. Orchestrators tend to send whole HTTP
 * error objects, which include request headers and therefore secrets. Those never reach the database.
 */
export function sanitizeDetail(detail: unknown): Json {
  if (detail === null || detail === undefined) return null;
  if (typeof detail === "string") return detail.slice(0, 500);
  if (typeof detail === "number" || typeof detail === "boolean") return detail;
  if (typeof detail === "object") {
    const out: Record<string, Json> = {};
    for (const key of DETAIL_KEYS) {
      const value = (detail as Record<string, unknown>)[key];
      if (typeof value === "string") out[key] = value.slice(0, 500);
      else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    }
    return out;
  }
  return null;
}

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
