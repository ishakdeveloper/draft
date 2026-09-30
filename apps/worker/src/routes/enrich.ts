import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { runCheck, type CheckResult } from "./check";
import { runImage, type ImageResult } from "./image";
import { runTranslate, type TranslateResult } from "./translate";

const BodySchema = z
  .object({ locales: z.array(z.string().min(2)).optional(), force: z.boolean().optional() })
  .default({});

export type StepOutcome<T> = ({ ok: true } & T) | { ok: false; code: string; message: string };

function settle<T>(result: PromiseSettledResult<T>): StepOutcome<T> {
  if (result.status === "fulfilled") return { ok: true, ...result.value };
  const err = result.reason;
  return {
    ok: false,
    code: err instanceof AppError ? err.code : "internal",
    message: err instanceof Error ? err.message : String(err),
  };
}

/**
 * Translate, generate the hero image and check the claims at the same time. They are independent, and n8n runs
 * branches one after another within an execution, so the concurrency has to live here. Both
 * steps are best effort and write their own event rows, so a failure in one is reported rather
 * than thrown. A failure that belongs to the draft itself, such as a missing draft or a wrong
 * status, hits both steps identically and is rethrown so the caller sees a real error.
 */
export const enrichRoute = new Hono<AppContext>().post("/drafts/:id/enrich", async (c) => {
  const deps = c.get("deps");
  const id = c.req.param("id");
  const body = BodySchema.parse(await c.req.json().catch(() => ({})));

  const [translated, imaged, checked] = await Promise.allSettled([
    runTranslate(deps, id, {
      ...(body.locales && { locales: body.locales }),
      ...(body.force !== undefined && { force: body.force }),
    }),
    runImage(deps, id, body.force === undefined ? {} : { force: body.force }),
    runCheck(deps, id, body.force === undefined ? {} : { force: body.force }),
  ]);

  // A failure that belongs to the draft itself hits every step with the same code, so it is a
  // real error rather than one step misbehaving.
  const settled = [translated, imaged, checked];
  if (settled.every((r) => r.status === "rejected")) {
    const reasons = settled.map((r) => (r as PromiseRejectedResult).reason);
    const first = reasons[0];
    if (
      first instanceof AppError &&
      reasons.every((r) => r instanceof AppError && r.code === first.code)
    ) {
      throw first;
    }
  }

  const translate: StepOutcome<TranslateResult> = settle(translated);
  const image: StepOutcome<ImageResult> = settle(imaged);
  const check: StepOutcome<CheckResult> = settle(checked);
  return c.json({ draft_id: id, translate, image, check, request_id: c.get("requestId") });
});
