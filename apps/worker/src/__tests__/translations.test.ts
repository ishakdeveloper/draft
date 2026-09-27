import { describe, expect, it } from "bun:test";
import { translationSchema } from "../lib/generator";
import { translateSystemPrompt } from "../lib/prompts";
import { buildTranslationInputs } from "../lib/shopify-translations";
import { pendingLocales } from "../routes/translate";

const listing = (suffix: string) => ({
  title: `Balm ${suffix}`,
  description_html: `<p>Text ${suffix}</p>`,
  bullets: ["a", "b", "c"],
  seo_title: `SEO ${suffix}`,
  seo_description: `Desc ${suffix}`,
});

describe("pendingLocales", () => {
  it("translates every target except the brand's own language", () => {
    expect(pendingLocales(["de", "nl", "fr"], "en", [])).toEqual(["de", "nl", "fr"]);
    expect(pendingLocales(["en", "de"], "en", [])).toEqual(["de"]);
  });
  it("skips locales already present unless forced", () => {
    expect(pendingLocales(["de", "nl", "fr"], "en", ["de"])).toEqual(["nl", "fr"]);
    expect(pendingLocales(["de", "nl", "fr"], "en", ["de"], undefined, true)).toEqual([
      "de",
      "nl",
      "fr",
    ]);
  });
  it("only honours requested locales that are brand targets", () => {
    expect(pendingLocales(["de", "nl"], "en", [], ["nl", "es"])).toEqual(["nl"]);
  });
});

describe("translationSchema", () => {
  it("requires one listing per requested locale", () => {
    const schema = translationSchema(["de", "fr"]);
    expect(schema.safeParse({ de: listing("de"), fr: listing("fr") }).success).toBe(true);
    expect(schema.safeParse({ de: listing("de") }).success).toBe(false);
  });
});

describe("translateSystemPrompt", () => {
  it("names the source and target languages and keeps the brand voice", () => {
    const p = translateSystemPrompt(
      { name: "Nordkind Skin", tone_guide: "Direct.", default_locale: "en" },
      ["de", "nl"],
    );
    expect(p).toContain("Source language: English");
    expect(p).toContain("de (German), nl (Dutch)");
    expect(p).toContain("Voice: Direct.");
  });
});

describe("buildTranslationInputs", () => {
  const translatable = [
    { key: "title", digest: "d-title" },
    { key: "body_html", digest: "d-body" },
    { key: "handle", digest: "d-handle" },
    { key: "meta_title", digest: "d-mt" },
    { key: "meta_description", digest: "d-md" },
  ];

  it("maps listing fields to Shopify keys with their digests", () => {
    const { inputs, skippedLocales } = buildTranslationInputs({ de: listing("de") }, translatable, [
      "en",
      "de",
    ]);
    expect(skippedLocales).toEqual([]);
    expect(inputs).toEqual([
      { locale: "de", key: "title", value: "Balm de", translatableContentDigest: "d-title" },
      {
        locale: "de",
        key: "body_html",
        value: "<p>Text de</p>",
        translatableContentDigest: "d-body",
      },
      { locale: "de", key: "meta_title", value: "SEO de", translatableContentDigest: "d-mt" },
      {
        locale: "de",
        key: "meta_description",
        value: "Desc de",
        translatableContentDigest: "d-md",
      },
    ]);
  });

  it("skips locales the shop has not enabled and never touches the handle", () => {
    const { inputs, skippedLocales } = buildTranslationInputs(
      { fr: listing("fr"), de: listing("de") },
      translatable,
      ["en", "de"],
    );
    expect(skippedLocales).toEqual(["fr"]);
    expect(inputs.every((i) => i.locale === "de" && i.key !== "handle")).toBe(true);
  });
});
