import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ListingContentSchema, type ListingContent } from "@draft/shared";
import { AppError } from "./errors";
import {
  generateSystemPrompt,
  generateUserPrompt,
  type BrandVoice,
  type ProductFacts,
} from "./prompts";

export interface GenerateResult {
  content: ListingContent;
  model: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number };
}

/** The LLM boundary. The worker talks to this interface; tests pass a fake. */
export interface ListingGenerator {
  generate(brand: BrandVoice, product: ProductFacts): Promise<GenerateResult>;
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
}
