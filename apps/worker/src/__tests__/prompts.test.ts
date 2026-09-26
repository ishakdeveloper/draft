import { describe, expect, it } from "bun:test";
import { generateSystemPrompt, generateUserPrompt } from "../lib/prompts";

const brand = { name: "Nordkind Skin", tone_guide: "Direct, minimal.", default_locale: "en" };

describe("prompts", () => {
  it("system prompt is stable for a brand and names the language", () => {
    const a = generateSystemPrompt(brand);
    const b = generateSystemPrompt({ ...brand });
    expect(a).toBe(b);
    expect(a).toContain("Language: English");
    expect(a).toContain("Direct, minimal.");
  });
  it("user prompt carries the product facts", () => {
    const p = generateUserPrompt({
      title: "Toner",
      body_html: "",
      product_type: null,
      tags: ["a"],
    });
    expect(p).toContain("Title: Toner");
    expect(p).toContain("(empty)");
    expect(p).toContain("Tags: a");
  });
});
