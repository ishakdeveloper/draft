import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ListingContentSchema, type ListingContent } from "@draft/shared";
import { z } from "zod";
import { AppError } from "./errors";
import { OpenAiListingGenerator } from "./generator-openai";
import {
  generateSystemPrompt,
  generateUserPrompt,
  translateSystemPrompt,
  translateUserPrompt,
  type BrandVoice,
  type ProductFacts,
} from "./prompts";

export interface GenerateResult {
  content: ListingContent;
  model: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number };
}

export interface TranslateResult {
  translations: Record<string, ListingContent>;
  model: string;
  usage: GenerateResult["usage"];
}

/** The LLM boundary. The worker talks to this interface; tests pass a fake. */
export interface ListingGenerator {
  generate(brand: BrandVoice, product: ProductFacts): Promise<GenerateResult>;
  translate(
    brand: BrandVoice,
    content: ListingContent,
    locales: readonly string[],
  ): Promise<TranslateResult>;
}

export function translationSchema(locales: readonly string[]) {
  return z.object(Object.fromEntries(locales.map((l) => [l, ListingContentSchema])));
}

export class ClaudeListingGenerator implements ListingGenerator {
  private client: Anthropic | null = null;

  constructor(
    private readonly apiKey: string | null,
    private readonly model: string,
  ) {}

  private getClient(): Anthropic {
    if (!this.apiKey) throw new AppError("config", "ANTHROPIC_API_KEY is not set");
    // n8n retries the whole step, so the SDK retries once at most.
    this.client ??= new Anthropic({ apiKey: this.apiKey, timeout: 90_000, maxRetries: 1 });
    return this.client;
  }

  async generate(brand: BrandVoice, product: ProductFacts): Promise<GenerateResult> {
    let response;
    try {
      response = await this.getClient().messages.parse({
        model: this.model,
        max_tokens: 4096,
        system: [
          { type: "text", text: generateSystemPrompt(brand), cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: generateUserPrompt(product) }],
        output_config: { effort: "low", format: zodOutputFormat(ListingContentSchema) },
      });
    } catch (err) {
      if (err instanceof APIError) {
        throw new AppError("llm_failed", `claude ${err.status ?? "error"}: ${err.message}`);
      }
      throw err;
    }

    if (response.stop_reason === "refusal") {
      throw new AppError(
        "llm_failed",
        "model declined to write this listing",
        response.stop_details,
      );
    }
    if (!response.parsed_output) {
      throw new AppError(
        "llm_failed",
        `no structured output (stop_reason ${response.stop_reason})`,
      );
    }
    return {
      content: response.parsed_output,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  }

  async translate(
    brand: BrandVoice,
    content: ListingContent,
    locales: readonly string[],
  ): Promise<TranslateResult> {
    const schema = translationSchema(locales);
    let response;
    try {
      response = await this.getClient().messages.parse({
        model: this.model,
        max_tokens: 8000,
        system: [
          {
            type: "text",
            text: translateSystemPrompt(brand, locales),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: translateUserPrompt(content) }],
        output_config: { effort: "low", format: zodOutputFormat(schema) },
      });
    } catch (err) {
      if (err instanceof APIError)
        throw new AppError("llm_failed", `claude ${err.status ?? "error"}: ${err.message}`);
      throw err;
    }
    if (response.stop_reason === "refusal") {
      throw new AppError(
        "llm_failed",
        "model declined to translate this listing",
        response.stop_details,
      );
    }
    if (!response.parsed_output) {
      throw new AppError(
        "llm_failed",
        `no structured output (stop_reason ${response.stop_reason})`,
      );
    }
    return {
      translations: response.parsed_output as Record<string, ListingContent>,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  }
}

export type ModelProvider = "anthropic" | "openai";

export function isModelProvider(value: string): value is ModelProvider {
  return value === "anthropic" || value === "openai";
}

export interface GeneratorConfig {
  provider: string;
  anthropicApiKey: string | null;
  claudeModel: string;
  openaiApiKey: string | null;
  openaiModel: string;
}

/**
 * Pick the model provider. Anthropic is the default; the key is checked when a step actually
 * runs, not here, so ingest and publish work on a Worker with no model key at all.
 */
export function createListingGenerator(config: GeneratorConfig): ListingGenerator {
  if (!isModelProvider(config.provider)) {
    throw new AppError("config", `unknown MODEL_PROVIDER "${config.provider}"`);
  }
  if (config.provider === "openai") {
    return new OpenAiListingGenerator(config.openaiApiKey, config.openaiModel);
  }
  return new ClaudeListingGenerator(config.anthropicApiKey, config.claudeModel);
}
