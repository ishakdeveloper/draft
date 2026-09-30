import { describe, expect, it } from "bun:test";
import { AppError } from "../lib/errors";
import {
  ClaudeListingGenerator,
  createListingGenerator,
  isModelProvider,
  type GeneratorConfig,
  type ListingGenerator,
} from "../lib/generator";
import { OpenAiListingGenerator } from "../lib/generator-openai";

const config = (over: Partial<GeneratorConfig> = {}): GeneratorConfig => ({
  provider: "anthropic",
  anthropicApiKey: "sk-ant-test",
  claudeModel: "claude-opus-5",
  openaiApiKey: "sk-test",
  openaiModel: "gpt-5",
  ...over,
});

const brand = { name: "Nordkind Skin", tone_guide: "Direct.", default_locale: "en" };
const product = { title: "Toner", body_html: "", product_type: "Toner", tags: [] };

describe("createListingGenerator", () => {
  it("defaults to Anthropic and selects OpenAI when asked", () => {
    expect(createListingGenerator(config())).toBeInstanceOf(ClaudeListingGenerator);
    expect(createListingGenerator(config({ provider: "openai" }))).toBeInstanceOf(
      OpenAiListingGenerator,
    );
  });

  it("refuses an unknown provider by name", () => {
    expect(() => createListingGenerator(config({ provider: "gemini" }))).toThrow(
      'unknown MODEL_PROVIDER "gemini"',
    );
  });

  it("builds without a key, so ingest and publish work on a worker with no model key", () => {
    expect(() => createListingGenerator(config({ anthropicApiKey: null }))).not.toThrow();
    expect(() =>
      createListingGenerator(config({ provider: "openai", openaiApiKey: null })),
    ).not.toThrow();
  });

  it("guards the provider name", () => {
    expect(isModelProvider("anthropic")).toBe(true);
    expect(isModelProvider("openai")).toBe(true);
    expect(isModelProvider("openrouter")).toBe(false);
  });
});

// One suite, run against both implementations: whatever the contract is, both must meet it.
const implementations: Array<[string, () => ListingGenerator, string]> = [
  ["Anthropic", () => new ClaudeListingGenerator(null, "claude-opus-5"), "ANTHROPIC_API_KEY"],
  ["OpenAI", () => new OpenAiListingGenerator(null, "gpt-5"), "OPENAI_API_KEY"],
];

describe.each(implementations)("%s generator contract", (_name, build, keyName) => {
  it("exposes both steps", () => {
    const generator = build();
    expect(typeof generator.generate).toBe("function");
    expect(typeof generator.translate).toBe("function");
  });

  it("fails generate with a clear config error when its key is missing", async () => {
    const error = await build()
      .generate(brand, product)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("config");
    expect((error as AppError).message).toContain(keyName);
  });

  it("fails translate the same way", async () => {
    const error = await build()
      .translate(
        brand,
        {
          title: "t",
          description_html: "<p>d</p>",
          bullets: ["a", "b", "c"],
          seo_title: "s",
          seo_description: "d",
        },
        ["de"],
      )
      .catch((e: unknown) => e);
    expect((error as AppError).code).toBe("config");
    expect((error as AppError).message).toContain(keyName);
  });
});
