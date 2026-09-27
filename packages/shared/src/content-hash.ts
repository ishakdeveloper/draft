/**
 * Make a value comparable across Shopify's formatting. Shopify re-serialises HTML on save
 * (it puts line breaks between list tags, for example), so whitespace next to a tag is
 * dropped and every other run of whitespace becomes one space.
 */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s*(<[^>]+>)\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
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
