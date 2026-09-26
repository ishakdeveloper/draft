import { z } from "zod";

export const LOCALES = ["en", "de", "nl", "fr"] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

/** The generated listing for one locale. Shared by the worker (LLM output) and the web app (edit form). */
export const ListingContentSchema = z.object({
  title: z.string().trim().min(1).max(70),
  description_html: z.string().trim().min(1),
  bullets: z.array(z.string().trim().min(1).max(160)).min(3).max(6),
  seo_title: z.string().trim().min(1).max(60),
  seo_description: z.string().trim().min(1).max(155),
});
export type ListingContent = z.infer<typeof ListingContentSchema>;

export const TranslationsSchema = z.partialRecord(LocaleSchema, ListingContentSchema);
export type Translations = z.infer<typeof TranslationsSchema>;
