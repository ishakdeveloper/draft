import { ListingContentSchema, type ListingContent } from "@draft/shared";
import OpenAI, { APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppError } from "./errors";
import type { GenerateResult, ListingGenerator, TranslateResult } from "./generator";
import { translationSchema } from "./generator";
import {
  generateSystemPrompt,
  generateUserPrompt,
  translateSystemPrompt,
  translateUserPrompt,
  type BrandVoice,
  type ProductFacts,
} from "./prompts";

/**
 * The same two steps against OpenAI. It exists to keep `ListingGenerator` an actual seam rather
 * than a claim: the prompts, the schema and the result shape are shared, and only the transport
 * differs. Selected with MODEL_PROVIDER.
 */
export class OpenAiListingGenerator implements ListingGenerator {
  private client: OpenAI | null = null;

  constructor(
    private readonly apiKey: string | null,
    private readonly model: string,
  ) {}

  private getClient(): OpenAI {
    if (!this.apiKey) throw new AppError("config", "OPENAI_API_KEY is not set");
    if (!this.model) throw new AppError("config", "OPENAI_MODEL is not set");
    // n8n retries the whole step, so the SDK retries once at most.
    this.client ??= new OpenAI({ apiKey: this.apiKey, timeout: 90_000, maxRetries: 1 });
    return this.client;
  }

  private async parse<T>(
    instructions: string,
    input: string,
    format: ReturnType<typeof zodTextFormat>,
  ): Promise<{ parsed: T; model: string; usage: GenerateResult["usage"] }> {
    let response;
    try {
      response = await this.getClient().responses.parse({
        model: this.model,
        instructions,
        input,
        text: { format },
      });
    } catch (err) {
      if (err instanceof APIError) {
        throw new AppError("llm_failed", `openai ${err.status ?? "error"}: ${err.message}`);
      }
      throw err;
    }

    const refusal = response.output
      .flatMap((item) => ("content" in item ? (item.content as Array<{ type: string }>) : []))
      .find((part) => part.type === "refusal");
    if (refusal) throw new AppError("llm_failed", "model declined this request", refusal);
    if (!response.output_parsed) {
      throw new AppError("llm_failed", `no structured output (status ${response.status})`);
    }

    return {
      parsed: response.output_parsed as T,
      model: response.model,
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        cache_read_input_tokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
      },
    };
  }

  async generate(brand: BrandVoice, product: ProductFacts): Promise<GenerateResult> {
    const { parsed, model, usage } = await this.parse<ListingContent>(
      generateSystemPrompt(brand),
      generateUserPrompt(product),
      zodTextFormat(ListingContentSchema, "listing"),
    );
    return { content: parsed, model, usage };
  }

  async translate(
    brand: BrandVoice,
    content: ListingContent,
    locales: readonly string[],
  ): Promise<TranslateResult> {
    const { parsed, model, usage } = await this.parse<Record<string, ListingContent>>(
      translateSystemPrompt(brand, locales),
      translateUserPrompt(content),
      zodTextFormat(translationSchema(locales), "translations"),
    );
    return { translations: parsed, model, usage };
  }
}
