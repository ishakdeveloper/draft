/** Collapse whitespace differences so a hash survives Shopify's payload formatting. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash of the product fields that a published draft writes back to Shopify and that the
 * products/update webhook carries. SEO fields are excluded because the webhook omits them.
 */
export async function contentHash(
  title: string,
  bodyHtml: string | null | undefined,
): Promise<string> {
  return sha256Hex(JSON.stringify([normalizeText(title), normalizeText(bodyHtml)]));
}
