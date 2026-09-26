import type { DraftStatus } from "./transitions";

export interface DraftSummary {
  id: string;
  version: number;
  status: DraftStatus;
  source_hash: string;
  publish_hash: string | null;
}

export type SkipReason = "brand_unknown" | "echo_of_publish" | "duplicate_source" | "in_flight";

export type IngestDecision =
  | { action: "create_draft"; version: number; supersedes: string | null }
  | { action: "skipped"; reason: SkipReason };

export interface IngestInput {
  /** contentHash() of the incoming product's title and body_html. */
  hash: string;
  /** Whether the product's vendor mapped to a known brand. */
  brandFound: boolean;
  /** Every draft for this product, any order. */
  drafts: readonly DraftSummary[];
}

/**
 * Decide what an incoming products/create|update webhook should do.
 * Pure so it can be unit tested; the worker does the database work around it.
 *
 * 1. Unknown vendor: skip.
 * 2. The incoming content is exactly what we last pushed to Shopify: it is the echo of
 *    our own publish, skip.
 * 3. The incoming content equals the latest draft's source and that draft is still
 *    useful (not failed or rejected): a tag or inventory edit fired the webhook, skip.
 * 4. A draft is mid-pipeline or awaiting publish: skip, the edit will be picked up by
 *    the next webhook once the pipeline settles.
 * 5. Otherwise create the next version; a pending_review draft is superseded.
 */
export function decideIngest({ hash, brandFound, drafts }: IngestInput): IngestDecision {
  if (!brandFound) return { action: "skipped", reason: "brand_unknown" };

  const sorted = drafts.toSorted((a, b) => b.version - a.version);
  const latest = sorted[0];

  const lastPublished = sorted.find((d) => d.status === "approved" || d.status === "published");
  if (lastPublished?.publish_hash === hash) return { action: "skipped", reason: "echo_of_publish" };

  if (
    latest &&
    latest.source_hash === hash &&
    latest.status !== "failed" &&
    latest.status !== "rejected"
  ) {
    return { action: "skipped", reason: "duplicate_source" };
  }

  if (latest && (latest.status === "drafting" || latest.status === "approved")) {
    return { action: "skipped", reason: "in_flight" };
  }

  return {
    action: "create_draft",
    version: (latest?.version ?? 0) + 1,
    supersedes: latest?.status === "pending_review" ? latest.id : null,
  };
}
