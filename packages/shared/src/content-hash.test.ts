import { describe, expect, it } from "bun:test";
import { contentHash, normalizeText } from "./content-hash";

describe("normalizeText", () => {
  it("collapses whitespace and line endings", () => {
    expect(normalizeText("  Hello\r\n  world \n")).toBe("Hello world");
  });
  it("treats null as empty", () => {
    expect(normalizeText(null)).toBe("");
  });
});

describe("contentHash", () => {
  it("is stable across whitespace differences", async () => {
    const a = await contentHash("Serum", "<p>Glow</p>\n");
    const b = await contentHash("Serum ", "<p>Glow</p>");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when the title changes", async () => {
    expect(await contentHash("A", "x")).not.toBe(await contentHash("B", "x"));
  });
});
