import { describe, expect, it } from "bun:test";
import { heroSyncDecision, pickNewMediaId } from "../lib/shopify-media";

describe("heroSyncDecision", () => {
  it("does nothing without an image", () => {
    expect(heroSyncDecision(null, null)).toBe("none");
  });
  it("skips an image that is already attached", () => {
    expect(heroSyncDecision("b/d/1.jpg", "b/d/1.jpg")).toBe("unchanged");
  });
  it("uploads a new or regenerated image", () => {
    expect(heroSyncDecision("b/d/1.jpg", null)).toBe("upload");
    expect(heroSyncDecision("b/d/2.jpg", "b/d/1.jpg")).toBe("upload");
  });
});

describe("pickNewMediaId", () => {
  it("finds the media that appeared after the upload", () => {
    expect(pickNewMediaId(["gid://a"], ["gid://a", "gid://b"])).toBe("gid://b");
  });
  it("handles a product that had no media", () => {
    expect(pickNewMediaId([], ["gid://x"])).toBe("gid://x");
  });
  it("returns null when nothing new appeared", () => {
    expect(pickNewMediaId(["gid://a"], ["gid://a"])).toBeNull();
  });
});
