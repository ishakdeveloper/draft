import { describe, expect, it } from "bun:test";
import { ALLOWED_TRANSITIONS, canTransition, DRAFT_STATUSES } from "./transitions";

describe("transitions", () => {
  it("only ever moves forward or toward a person", () => {
    expect(canTransition("drafting", "pending_review")).toBe(true);
    expect(canTransition("pending_review", "approved")).toBe(true);
    expect(canTransition("pending_review", "rejected")).toBe(true);
    expect(canTransition("approved", "published")).toBe(true);
    expect(canTransition("drafting", "approved")).toBe(false);
    expect(canTransition("published", "pending_review")).toBe(false);
  });
  it("terminal states have no exits", () => {
    for (const s of ["rejected", "published", "failed"] as const) {
      expect(ALLOWED_TRANSITIONS[s]).toEqual([]);
    }
  });
  it("covers every status", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).toSorted()).toEqual(DRAFT_STATUSES.toSorted());
  });
});
