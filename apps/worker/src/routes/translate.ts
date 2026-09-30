import { ListingContentSchema, TranslationsSchema, type Translations } from "@draft/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext, Deps } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder } from "../lib/events";

const BodySchema = z
  .object({ locales: z.array(z.string().min(2)).optional(), force: z.boolean().optional() })
  .default({});
export type TranslateBody = z.infer<typeof BodySchema>;

export type TranslateResult =
  | { draft_id: string; skipped: true; reason: string; locales: string[] }
  | { draft_id: string; locales: string[]; translations: Translations };

/** Locales still to translate: the brand's targets minus its own language minus what is already there. */
export function pendingLocales(
  targets: readonly string[],
  defaultLocale: string,
  existing: readonly string[],
  requested?: readonly string[],
  force = false,
): string[] {
  const wanted = (requested ?? targets).filter((l) => l !== defaultLocale && targets.includes(l));
  return force ? wanted : wanted.filter((l) => !existing.includes(l));
}

/** The translate step. Exported so the enrich route can run it beside the image step. */
export async function runTranslate(
  deps: Deps,
  id: string,
  body: TranslateBody,
): Promise<TranslateResult> {
  const { db, generator } = deps;

  const { data: draft, error } = await db
    .from("listing_drafts")
    .select(
      "id, brand_id, product_id, status, content, translations, brand:brands(name, tone_guide, default_locale, target_locales)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("database", error.message);
  if (!draft) throw new AppError("draft_not_found", `draft ${id} not found`);

  const recorder = new StepRecorder(db, "translate", {
    brand_id: draft.brand_id,
    product_id: draft.product_id,
    draft_id: draft.id,
  });

  if (draft.status !== "drafting" && draft.status !== "pending_review") {
    throw new AppError("invalid_transition", `cannot translate a draft in status ${draft.status}`);
  }
  const content = ListingContentSchema.safeParse(draft.content);
  if (!content.success)
    throw new AppError("invalid_transition", "generate has not produced a listing yet");

  const existing = TranslationsSchema.safeParse(draft.translations);
  const current = existing.success ? existing.data : {};
  const locales = pendingLocales(
    draft.brand.target_locales,
    draft.brand.default_locale,
    Object.keys(current),
    body.locales,
    body.force,
  );
  if (locales.length === 0) {
    const result = {
      draft_id: draft.id,
      skipped: true as const,
      reason: "already_translated",
      locales: Object.keys(current),
    };
    await recorder.finish("skipped", result);
    return result;
  }

  let translated;
  try {
    translated = await generator.translate(draft.brand, content.data, locales);
  } catch (err) {
    await recorder.finish("error", {
      message: err instanceof Error ? err.message : String(err),
      locales,
    });
    throw err;
  }

  // Merge rather than overwrite, so a concurrent run for other locales is not lost.
  const { data: latest } = await db
    .from("listing_drafts")
    .select("translations")
    .eq("id", draft.id)
    .single();
  const base = TranslationsSchema.safeParse(latest?.translations);
  const merged = { ...(base.success ? base.data : {}), ...translated.translations };

  const { error: updateError } = await db
    .from("listing_drafts")
    .update({ translations: merged })
    .eq("id", draft.id);
  if (updateError) {
    await recorder.finish("error", { message: updateError.message });
    throw new AppError("database", updateError.message);
  }

  await recorder.finish("ok", { locales, model: translated.model, usage: translated.usage });
  return { draft_id: draft.id, locales, translations: merged };
}

export const translateRoute = new Hono<AppContext>().post("/drafts/:id/translate", async (c) => {
  const body = BodySchema.parse(await c.req.json().catch(() => ({})));
  const result = await runTranslate(c.get("deps"), c.req.param("id"), body);
  return c.json({ ...result, request_id: c.get("requestId") });
});
