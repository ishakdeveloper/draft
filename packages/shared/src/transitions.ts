export const DRAFT_STATUSES = [
  "drafting",
  "pending_review",
  "approved",
  "rejected",
  "published",
  "failed",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** Mirrors enforce_draft_transition() in supabase/migrations/0001_core.sql. Keep both in sync. */
export const ALLOWED_TRANSITIONS: Readonly<Record<DraftStatus, readonly DraftStatus[]>> = {
  drafting: ["pending_review", "failed"],
  pending_review: ["approved", "rejected"],
  approved: ["published", "failed"],
  rejected: [],
  published: [],
  failed: [],
};

/** Statuses a signed-in reviewer may set. Everything else is the pipeline's job. */
export const REVIEWER_TRANSITIONS: readonly DraftStatus[] = ["approved", "rejected"];

export const OPEN_STATUSES: readonly DraftStatus[] = ["drafting", "pending_review", "approved"];

export function canTransition(from: DraftStatus, to: DraftStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
