import { describe, expect, it } from "bun:test";
import {
  buildReviewUpdate,
  formatDuration,
  isDraftStatus,
  parseContent,
  parseTranslations,
  timeAgo,
  type ReviewFormValues,
} from "../review";

const content = {
  title: "Oat Milk Cleanser",
  description_html: "<p>Gentle.</p>",
  bullets: ["one", "two", "three"],
  seo_title: "Oat Milk Cleanser",
  seo_description: "A gentle cleanser.",
};
const values = (note = ""): ReviewFormValues => ({ content, review_note: note });

describe("buildReviewUpdate", () => {
  it("save keeps the status untouched", () => {
    expect(buildReviewUpdate("save", values())).toEqual({
      ok: true,
      update: { content, review_note: null },
    });
  });
  it("approve sets approved and keeps a note if given", () => {
    expect(buildReviewUpdate("approve", values(" ship it "))).toEqual({
      ok: true,
      update: { content, review_note: "ship it", status: "approved" },
    });
  });
  it("reject requires a note", () => {
    const result = buildReviewUpdate("reject", values("   "));
    expect(result.ok).toBe(false);
  });
  it("reject with a note sets rejected", () => {
    expect(buildReviewUpdate("reject", values("too salesy"))).toEqual({
      ok: true,
      update: { content, review_note: "too salesy", status: "rejected" },
    });
  });
  it("never writes a pipeline-owned status", () => {
    for (const intent of ["save", "approve", "reject"] as const) {
      const r = buildReviewUpdate(intent, values("n"));
      if (r.ok) expect([undefined, "approved", "rejected"]).toContain(r.update.status);
    }
  });
});

describe("parsers", () => {
  it("parseContent returns null for missing or malformed content", () => {
    expect(parseContent(null)).toBeNull();
    expect(parseContent({ title: "x" })).toBeNull();
    expect(parseContent(content)).toEqual(content);
  });
  it("parseTranslations drops invalid shapes", () => {
    expect(parseTranslations({ de: content })).toEqual({ de: content });
    expect(parseTranslations("nope")).toEqual({});
  });
  it("isDraftStatus guards unknown values", () => {
    expect(isDraftStatus("pending_review")).toBe(true);
    expect(isDraftStatus("deleted")).toBe(false);
    expect(isDraftStatus(undefined)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(120)).toBe("120 ms");
    expect(formatDuration(7900)).toBe("7.9 s");
    expect(formatDuration(12_400)).toBe("12 s");
    expect(formatDuration(null)).toBe("");
  });
  it("formats relative time", () => {
    const now = Date.parse("2026-09-27T12:00:00Z");
    expect(timeAgo("2026-09-27T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-09-27T11:15:00Z", now)).toBe("45 min ago");
    expect(timeAgo("2026-09-27T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-09-25T12:00:00Z", now)).toBe("2 d ago");
  });
});
