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
