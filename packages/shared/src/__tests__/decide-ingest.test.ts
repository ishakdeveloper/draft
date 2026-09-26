import { describe, expect, it } from "bun:test";
import { decideIngest, type DraftSummary } from "../decide-ingest";

const draft = (over: Partial<DraftSummary>): DraftSummary => ({
  id: over.id ?? "d1",
  version: over.version ?? 1,
  status: over.status ?? "published",
  source_hash: over.source_hash ?? "src",
  publish_hash: over.publish_hash ?? null,
});

describe("decideIngest", () => {
  it("skips products whose vendor has no brand", () => {
    expect(decideIngest({ hash: "h", brandFound: false, drafts: [] })).toEqual({
      action: "skipped",
      reason: "brand_unknown",
    });
  });

  it("creates version 1 for a new product", () => {
    expect(decideIngest({ hash: "h", brandFound: true, drafts: [] })).toEqual({
      action: "create_draft",
      version: 1,
      supersedes: null,
    });
  });

  it("recognises the echo of its own publish", () => {
    const drafts = [draft({ status: "published", source_hash: "old", publish_hash: "pub" })];
    expect(decideIngest({ hash: "pub", brandFound: true, drafts })).toEqual({
      action: "skipped",
      reason: "echo_of_publish",
    });
  });

  it("recognises the echo while the draft is still approved (publish in flight)", () => {
    const drafts = [draft({ status: "approved", source_hash: "old", publish_hash: "pub" })];
    expect(decideIngest({ hash: "pub", brandFound: true, drafts })).toEqual({
      action: "skipped",
      reason: "echo_of_publish",
    });
  });

  it("skips unrelated edits that do not change title or body", () => {
    const drafts = [draft({ status: "pending_review", source_hash: "same" })];
    expect(decideIngest({ hash: "same", brandFound: true, drafts })).toEqual({
      action: "skipped",
      reason: "duplicate_source",
    });
  });

  it("regenerates when the only draft for this content failed", () => {
    const drafts = [draft({ id: "f", status: "failed", source_hash: "same" })];
    expect(decideIngest({ hash: "same", brandFound: true, drafts })).toEqual({
      action: "create_draft",
      version: 2,
      supersedes: null,
    });
  });

  it("supersedes a pending draft when the product changes again", () => {
    const drafts = [draft({ id: "p", version: 3, status: "pending_review", source_hash: "old" })];
    expect(decideIngest({ hash: "new", brandFound: true, drafts })).toEqual({
      action: "create_draft",
      version: 4,
      supersedes: "p",
    });
  });

  it("waits while a draft is mid-pipeline or awaiting publish", () => {
    for (const status of ["drafting", "approved"] as const) {
      const drafts = [draft({ status, source_hash: "old", publish_hash: "other" })];
      expect(decideIngest({ hash: "new", brandFound: true, drafts })).toEqual({
        action: "skipped",
        reason: "in_flight",
      });
    }
  });

  it("uses the highest version regardless of input order", () => {
    const drafts = [
      draft({ id: "a", version: 1, status: "rejected" }),
      draft({ id: "c", version: 3, status: "rejected", source_hash: "x" }),
      draft({ id: "b", version: 2, status: "rejected" }),
    ];
    expect(decideIngest({ hash: "new", brandFound: true, drafts })).toEqual({
      action: "create_draft",
      version: 4,
      supersedes: null,
    });
  });
});
