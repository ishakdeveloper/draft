import { describe, expect, it } from "bun:test";
import { contentHash, normalizeText } from "../content-hash";

describe("normalizeText", () => {
  it("collapses whitespace and line endings", () => {
    expect(normalizeText("  Hello\r\n  world \n")).toBe("Hello world");
    expect(normalizeText("<ul>\n<li>\n<b>a</b> b</li>\n</ul>")).toBe("<ul><li><b>a</b>b</li></ul>");
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
  it("matches Shopify's re-serialised list HTML (the echo after a publish)", async () => {
    const sent =
      "<p>Oil.</p><ul><li><strong>Base:</strong> sweet almond oil</li><li><strong>Scent:</strong> amber</li></ul>";
    const echoed =
      "<p>Oil.</p><ul>\n<li>\n<strong>Base:</strong> sweet almond oil</li>\n<li>\n<strong>Scent:</strong> amber</li>\n</ul>";
    expect(await contentHash("Bath Oil", echoed)).toBe(await contentHash("Bath Oil", sent));
  });
  it("still sees a real text change", async () => {
    expect(await contentHash("T", "<p>one</p>")).not.toBe(await contentHash("T", "<p>two</p>"));
  });
  it("changes when the title changes", async () => {
    expect(await contentHash("A", "x")).not.toBe(await contentHash("B", "x"));
  });
});
