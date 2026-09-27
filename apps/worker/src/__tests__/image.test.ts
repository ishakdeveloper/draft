import { describe, expect, it } from "bun:test";
import {
  containerFor,
  createImageProvider,
  heroImagePrompt,
  UnconfiguredImageProvider,
  WorkersAiFlux,
} from "../lib/image";
import { heroImagePath } from "../routes/image";

describe("heroImagePrompt", () => {
  it("describes the container, applies the brand's styling and asks for a blank surface", () => {
    const p = heroImagePrompt(
      { title: "Rosehip Night Oil", product_type: "Face oil" },
      { visual_notes: "Golden hour, terracotta and sand tones." },
    );
    expect(p).toContain("an amber glass dropper bottle with a completely blank, unprinted surface");
    expect(p).toContain("Styling: Golden hour, terracotta and sand tones.");
    expect(p.length).toBeLessThanOrEqual(2000);
  });
  it("never includes the product name or type, which models would paint onto a label", () => {
    const p = heroImagePrompt(
      { title: "Rosehip Night Oil", product_type: "Face oil" },
      { visual_notes: "" },
    );
    expect(p).not.toContain("Rosehip");
    expect(p.toLowerCase()).not.toContain("face oil");
  });
  it("maps product types to container shapes", () => {
    expect(containerFor("Day cream")).toBe("a squat cosmetic jar with a lid");
    expect(containerFor("Balm")).toBe("a squat cosmetic jar with a lid");
    expect(containerFor("Essence")).toBe("an amber glass dropper bottle");
    expect(containerFor("Cleanser")).toBe("a pump bottle");
    expect(containerFor(null)).toBe("a simple cosmetic bottle");
  });
  it("works without a product type or visual notes", () => {
    const p = heroImagePrompt({ title: "Balm", product_type: null }, { visual_notes: "" });
    expect(p).not.toContain("Styling:");
    expect(p).toContain("a simple cosmetic bottle");
  });
});

describe("heroImagePath", () => {
  it("puts the brand id first so the Storage policy can check membership", () => {
    expect(heroImagePath("brand-1", "draft-9", "abc")).toBe("brand-1/draft-9/abc.jpg");
  });
});

describe("createImageProvider", () => {
  const ai = {} as Ai;
  it("uses Workers AI by default and refuses unknown providers clearly", async () => {
    expect(createImageProvider("workers-ai", ai)).toBeInstanceOf(WorkersAiFlux);
    const other = createImageProvider("openai", ai);
    expect(other).toBeInstanceOf(UnconfiguredImageProvider);
    await expect(other.generate("x")).rejects.toThrow('image provider "openai" is not configured');
  });
  it("decodes the base64 JPEG Workers AI returns", async () => {
    const fake = { run: async () => ({ image: btoa("\xff\xd8\xff") }) } as unknown as Ai;
    const img = await new WorkersAiFlux(fake).generate("p");
    expect(Array.from(img.bytes)).toEqual([0xff, 0xd8, 0xff]);
    expect(img.contentType).toBe("image/jpeg");
  });
});
