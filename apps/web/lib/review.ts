import { z } from "zod";
import {
  VerifiedClaimsSchema,
  type VerifiedClaim,
  ListingContentSchema,
  TranslationsSchema,
  type DraftStatus,
  type ListingContent,
  type Translations,
} from "@draft/shared";

export type ReviewIntent = "save" | "approve" | "reject";

export const ReviewFormSchema = z.object({
  content: ListingContentSchema,
  review_note: z.string().trim().max(1000, "Keep the note under 1000 characters"),
});
export type ReviewFormValues = z.infer<typeof ReviewFormSchema>;

/** The columns a reviewer may write (mirrors the column grant in 0002_rls.sql). */
export interface ReviewUpdate {
  content: ListingContent;
  review_note: string | null;
  status?: Extract<DraftStatus, "approved" | "rejected">;
}

export type ReviewUpdateResult = { ok: true; update: ReviewUpdate } | { ok: false; error: string };

export function buildReviewUpdate(
  intent: ReviewIntent,
  values: ReviewFormValues,
): ReviewUpdateResult {
  const note = values.review_note.trim();
  if (intent === "reject" && !note) {
    return {
      ok: false,
      error: "Add a note saying what was wrong, so the next version can fix it.",
    };
  }
  const update: ReviewUpdate = { content: values.content, review_note: note || null };
  if (intent === "approve") update.status = "approved";
  if (intent === "reject") update.status = "rejected";
  return { ok: true, update };
}

export function parseContent(value: unknown): ListingContent | null {
  const parsed = ListingContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseTranslations(value: unknown): Translations {
  const parsed = TranslationsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export const STATUS_TABS: ReadonlyArray<{ status: DraftStatus; label: string }> = [
  { status: "pending_review", label: "To review" },
  { status: "drafting", label: "Drafting" },
  { status: "approved", label: "Approved" },
  { status: "published", label: "Published" },
  { status: "rejected", label: "Rejected" },
  { status: "failed", label: "Failed" },
];

export function isDraftStatus(value: string | undefined): value is DraftStatus {
  return STATUS_TABS.some((t) => t.status === value);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

/** Claims as stored by the check step. Anything malformed is treated as "not checked". */
export function parseClaims(value: unknown): VerifiedClaim[] | null {
  if (value === null || value === undefined) return null;
  const parsed = VerifiedClaimsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function unverifiedCount(claims: VerifiedClaim[] | null): number {
  return claims ? claims.filter((c) => !c.verified).length : 0;
}
