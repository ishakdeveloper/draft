import { z } from "zod";

export const CLAIM_FIELDS = [
  "title",
  "description_html",
  "bullets",
  "seo_title",
  "seo_description",
] as const;
export const ClaimFieldSchema = z.enum(CLAIM_FIELDS);
export type ClaimField = z.infer<typeof ClaimFieldSchema>;

/** One factual statement from the generated listing, as the checking model reported it. */
export const ClaimSchema = z.object({
  field: ClaimFieldSchema,
  /** The sentence or fragment being judged, copied from the listing. */
  text: z.string().min(1),
  /** The model's own verdict. Never trusted on its own, see verifyClaims. */
  supported: z.boolean(),
  /** The passage of the source the model says supports it, meant to be verbatim. */
  source_span: z.string().nullable(),
  /** Why it is unsupported, when it is. */
  note: z.string().nullable(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const ClaimCheckSchema = z.object({ claims: z.array(ClaimSchema) });
export type ClaimCheck = z.infer<typeof ClaimCheckSchema>;

/** A claim after our own check of the span against the source. */
export const VerifiedClaimSchema = ClaimSchema.extend({ verified: z.boolean() });
export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>;
export const VerifiedClaimsSchema = z.array(VerifiedClaimSchema);

/** Strip tags and collapse whitespace, so a span can be compared with the text it came from. */
export function plainText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether the span really occurs in the source. Compared on plain text, case-insensitively,
 * because a model reflows whitespace and capitalisation when it quotes.
 */
export function containsVerbatim(source: string, span: string | null | undefined): boolean {
  const needle = plainText(span).toLowerCase();
  if (needle.length === 0) return false;
  return plainText(source).toLowerCase().includes(needle);
}

/**
 * Fail closed, the rule borrowed from Docket: a claim counts as verified only when the model
 * says it is supported AND the passage it cited is actually in the source. A model that says
 * "supported" while quoting something the source never said is exactly the failure this catches,
 * so its own verdict is never enough.
 */
export function verifyClaims(claims: readonly Claim[], sourceText: string): VerifiedClaim[] {
  return claims.map((claim) => ({
    ...claim,
    verified: claim.supported && containsVerbatim(sourceText, claim.source_span),
  }));
}

export function unverifiedClaims(claims: readonly VerifiedClaim[]): VerifiedClaim[] {
  return claims.filter((c) => !c.verified);
}
