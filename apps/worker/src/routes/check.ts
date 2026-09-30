import {
  ListingContentSchema,
  plainText,
  unverifiedClaims,
  verifyClaims,
  type VerifiedClaim,
} from "@draft/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext, Deps } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";

const BodySchema = z.object({ force: z.boolean().optional() }).default({});
export type CheckBody = z.infer<typeof BodySchema>;

export type CheckResult =
  | { draft_id: string; skipped: true; reason: string }
  | { draft_id: string; claims: VerifiedClaim[]; unverified: number };

/**
 * Check the generated listing against the product text it was written from. The model reports
 * each factual statement and quotes its evidence; `verifyClaims` then checks that quote really
 * occurs in the source, so a confident model that invents a citation is caught in code.
 *
 * It never changes the draft's status. An unsupported claim is information for the reviewer,
 * not a gate: nothing here promotes or blocks a draft.
 */
export async function runCheck(deps: Deps, id: string, body: CheckBody): Promise<CheckResult> {
  const { db, generator } = deps;

  const { data: draft, error } = await db
    .from("listing_drafts")
    .select(
      "id, brand_id, product_id, status, content, claims, source_title, source_body_html, brand:brands(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("database", error.message);
  if (!draft) throw new AppError("draft_not_found", `draft ${id} not found`);

  const recorder = new StepRecorder(db, "check", {
    brand_id: draft.brand_id,
    product_id: draft.product_id,
    draft_id: draft.id,
  });

  if (draft.status !== "drafting" && draft.status !== "pending_review") {
    throw new AppError("invalid_transition", `cannot check a draft in status ${draft.status}`);
  }
  const content = ListingContentSchema.safeParse(draft.content);
  if (!content.success) {
    throw new AppError("invalid_transition", "generate has not produced a listing yet");
  }
  if (draft.claims && !body.force) {
    const result = { draft_id: draft.id, skipped: true as const, reason: "already_checked" };
    await recorder.finish("skipped", result);
    return result;
  }

  // The evidence is the product as Shopify holds it, plus the brand's own name, which is known
  // context rather than something the listing invented. Keeping it in the source means the rule
  // is enforced in code instead of asked for in a prompt.
  const sourceText = `${draft.brand.name}\n${draft.source_title}\n${plainText(draft.source_body_html)}`;

  let checked;
  try {
    checked = await generator.checkClaims(sourceText, content.data);
  } catch (err) {
    await recorder.finish("error", { message: err instanceof Error ? err.message : String(err) });
    throw err;
  }

  const claims = verifyClaims(checked.claims, sourceText);
  const unverified = unverifiedClaims(claims);

  const { error: updateError } = await db
    .from("listing_drafts")
    .update({ claims, claims_checked_at: new Date().toISOString() })
    .eq("id", draft.id);
  if (updateError) {
    await recorder.finish("error", { message: updateError.message });
    throw new AppError("database", updateError.message);
  }

  await recorder.finish("ok", {
    model: checked.model,
    usage: checked.usage,
    claims: claims.length,
    unverified: unverified.length,
  });
  return { draft_id: draft.id, claims, unverified: unverified.length };
}

export const checkRoute = new Hono<AppContext>().post("/drafts/:id/check", async (c) => {
  const body = BodySchema.parse(await c.req.json().catch(() => ({})));
  const result = await runCheck(c.get("deps"), c.req.param("id"), body);
  return c.json({ ...result, request_id: c.get("requestId") });
});
