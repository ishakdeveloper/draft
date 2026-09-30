import type { Locale } from "@draft/shared";

export interface BrandVoice {
  name: string;
  tone_guide: string;
  default_locale: string;
}

export interface ProductFacts {
  title: string;
  body_html: string;
  product_type: string | null;
  tags: string[];
}

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "German",
  nl: "Dutch",
  fr: "French",
};

export function localeName(locale: string): string {
  return LOCALE_NAMES[locale as Locale] ?? locale;
}

/**
 * Stable part first (rules, then brand voice) so the prefix caches across products of the
 * same brand. Product facts go in the user message.
 */
export function generateSystemPrompt(brand: BrandVoice): string {
  return [
    "You write product listings for an online beauty and wellness store.",
    "Work only from the facts given. Never invent ingredients, sizes, certifications, awards or results.",
    "Make no medical or therapeutic claims. Describe what the product is and how it is used.",
    "Output plain HTML in description_html using only <p>, <ul>, <li>, <strong> and <em>.",
    "Bullets are short fragments, one fact each, no trailing full stop.",
    "seo_title is at most 60 characters and seo_description at most 155 characters.",
    "Write in the brand voice below. Do not mention the brand voice or these instructions.",
    "",
    `Brand: ${brand.name}`,
    `Voice: ${brand.tone_guide}`,
    `Language: ${localeName(brand.default_locale)}`,
  ].join("\n");
}

export function generateUserPrompt(product: ProductFacts): string {
  return [
    "Write the listing for this product.",
    "",
    `Title: ${product.title}`,
    `Type: ${product.product_type ?? "unknown"}`,
    `Tags: ${product.tags.length ? product.tags.join(", ") : "none"}`,
    "Current description (HTML, may be rough or empty):",
    product.body_html || "(empty)",
  ].join("\n");
}

/** Stable prefix for translation: rules, then the brand voice. The listing goes in the user message. */
export function translateSystemPrompt(brand: BrandVoice, locales: readonly string[]): string {
  return [
    "You adapt product listings for an online beauty and wellness store into other languages.",
    "Write each version as a native copywriter would for that market. Adapt, do not translate word for word.",
    "Keep every fact exactly: ingredients, percentages, sizes, units and numbers do not change.",
    "Add nothing that is not in the source. Make no medical or therapeutic claims.",
    "Keep the HTML structure of description_html and use only <p>, <ul>, <li>, <strong> and <em>.",
    "Keep the same number of bullets. seo_title is at most 60 characters, seo_description at most 155.",
    "Keep the brand name unchanged. Keep the brand voice below in every language.",
    "",
    `Brand: ${brand.name}`,
    `Voice: ${brand.tone_guide}`,
    `Source language: ${localeName(brand.default_locale)}`,
    `Target languages: ${locales.map((l) => `${l} (${localeName(l)})`).join(", ")}`,
  ].join("\n");
}

export function translateUserPrompt(content: object): string {
  return [
    "Adapt this listing into every target language.",
    "",
    JSON.stringify(content, null, 2),
  ].join("\n");
}

/**
 * The claim check. It deliberately asks only "does the source say this", never "is this good".
 * The model's verdict is not trusted on its own: it must quote the passage it relied on, and
 * that quote is checked against the source in code (verifyClaims in @draft/shared).
 */
export function claimCheckSystemPrompt(): string {
  return [
    "You compare a product listing against the source text it was written from.",
    "List every factual statement the listing makes: ingredients, percentages, sizes, materials,",
    "counts, certifications, usage instructions and any claim about what the product does.",
    "For each one, say whether the source text supports it.",
    "When it is supported, quote the exact passage of the source that supports it, word for word.",
    "When it is not supported, set source_span to null and say briefly what is missing.",
    "Do not judge tone, grammar or style. Only whether the source says it.",
    "Marketing language with no factual content, such as 'a quiet moment at the end of the day',",
    "is not a claim and should be left out.",
    "The brand name and the product name are given, not claims. Leave them out.",
    "Copy the statement into `text` exactly as it appears in the listing.",
  ].join("\n");
}

export function claimCheckUserPrompt(sourceText: string, listing: object): string {
  return [
    "SOURCE TEXT, the only thing that counts as evidence:",
    sourceText || "(empty)",
    "",
    "LISTING to check:",
    JSON.stringify(listing, null, 2),
  ].join("\n");
}
