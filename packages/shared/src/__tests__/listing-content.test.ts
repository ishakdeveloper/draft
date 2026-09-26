import { describe, expect, it } from "bun:test";
import { ListingContentSchema, TranslationsSchema } from "../listing-content";

const valid = {
  title: "Hydrating Night Serum",
  description_html: "<p>Wake up to rested skin.</p>",
  bullets: ["Hyaluronic acid", "Fragrance free", "50 ml"],
  seo_title: "Hydrating Night Serum",
  seo_description: "A lightweight night serum that hydrates while you sleep.",
};

describe("ListingContentSchema", () => {
  it("accepts a well formed listing", () => {
    expect(ListingContentSchema.parse(valid)).toEqual(valid);
  });
  it("rejects too few bullets and over-long seo fields", () => {
    expect(ListingContentSchema.safeParse({ ...valid, bullets: ["one"] }).success).toBe(false);
    expect(ListingContentSchema.safeParse({ ...valid, seo_title: "x".repeat(61) }).success).toBe(
      false,
    );
  });
  it("allows partial translations keyed by locale", () => {
    expect(TranslationsSchema.parse({ de: valid })).toEqual({ de: valid });
    expect(TranslationsSchema.safeParse({ xx: valid }).success).toBe(false);
  });
});
