import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
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
 * Translate and generate the hero image at the same time. They are independent, and n8n runs
 * branches one after another within an execution, so the concurrency has to live here. Both
 * steps are best effort and write their own event rows, so a failure in one is reported rather
 * than thrown. A failure that belongs to the draft itself, such as a missing draft or a wrong
 * status, hits both steps identically and is rethrown so the caller sees a real error.
 */
export const enrichRoute = new Hono<AppContext>().post("/drafts/:id/enrich", async (c) => {
  const deps = c.get("deps");
  const id = c.req.param("id");
  const body = BodySchema.parse(await c.req.json().catch(() => ({})));

  const [translated, imaged] = await Promise.allSettled([
    runTranslate(deps, id, {
      ...(body.locales && { locales: body.locales }),
      ...(body.force !== undefined && { force: body.force }),
    }),
    runImage(deps, id, body.force === undefined ? {} : { force: body.force }),
  ]);

  if (translated.status === "rejected" && imaged.status === "rejected") {
    const a = translated.reason;
    const b = imaged.reason;
    if (a instanceof AppError && b instanceof AppError && a.code === b.code) throw a;
  }

  const translate: StepOutcome<TranslateResult> = settle(translated);
  const image: StepOutcome<ImageResult> = settle(imaged);
  return c.json({ draft_id: id, translate, image, request_id: c.get("requestId") });
});
