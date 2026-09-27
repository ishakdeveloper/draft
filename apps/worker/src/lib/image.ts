import { AppError } from "./errors";

export interface GeneratedImage {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png";
  model: string;
}

/** The image boundary. Workers AI by default; tests and other providers implement the same shape. */
export interface ImageProvider {
  generate(prompt: string): Promise<GeneratedImage>;
}

export const FLUX_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Flux Schnell on Workers AI: returns a base64 JPEG. Runs on Cloudflare's own GPUs, no extra vendor. */
export class WorkersAiFlux implements ImageProvider {
  constructor(private readonly ai: Ai) {}

  async generate(prompt: string): Promise<GeneratedImage> {
    let result: { image?: string };
    try {
      result = (await this.ai.run(FLUX_MODEL, { prompt, steps: 6 })) as { image?: string };
    } catch (err) {
      throw new AppError(
        "llm_failed",
        `workers ai: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!result.image) throw new AppError("llm_failed", "workers ai returned no image");
    return { bytes: fromBase64(result.image), contentType: "image/jpeg", model: FLUX_MODEL };
  }
}

/** Placeholder for a second provider, selected with IMAGE_PROVIDER. Not wired to any vendor yet. */
export class UnconfiguredImageProvider implements ImageProvider {
  constructor(private readonly name: string) {}
  async generate(): Promise<GeneratedImage> {
    throw new AppError("config", `image provider "${this.name}" is not configured`);
  }
}

export function createImageProvider(name: string, ai: Ai): ImageProvider {
  return name === "workers-ai" ? new WorkersAiFlux(ai) : new UnconfiguredImageProvider(name);
}

/** A container shape for the product type, so the prompt names an object, never a word to print. */
export function containerFor(productType: string | null): string {
  const t = (productType ?? "").toLowerCase();
  if (/(oil|serum|essence|toner|drops)/.test(t)) return "an amber glass dropper bottle";
  if (/(cream|balm|mask|butter|scrub|salt)/.test(t)) return "a squat cosmetic jar with a lid";
  if (/(cleanser|wash|shampoo|lotion)/.test(t)) return "a pump bottle";
  return "a simple cosmetic bottle";
}

/**
 * A product shot prompt built from the container shape and the brand's visual notes. The
 * product name and type are left out on purpose: image models paint them onto the label.
 */
export function heroImagePrompt(
  product: { title: string; product_type: string | null },
  brand: { visual_notes: string },
): string {
  return [
    `Editorial studio photograph of ${containerFor(product.product_type)} with a completely blank, unprinted surface,`,
    "centred on a seamless plain backdrop, sharp focus, soft natural shadows.",
    brand.visual_notes ? `Styling: ${brand.visual_notes}` : "",
    "Surfaces and walls are clean and unmarked. Square composition, minimal props, no people.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2000);
}
