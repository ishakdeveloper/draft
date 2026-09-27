import { describe, expect, it } from "bun:test";
import { sanitizeListingHtml } from "../sanitize-html";

describe("sanitizeListingHtml", () => {
  it("keeps the allowed formatting tags and drops their attributes", () => {
    expect(
      sanitizeListingHtml('<p class="x" onclick="evil()">Hi <strong style="c">there</strong></p>'),
    ).toBe("<p>Hi <strong>there</strong></p>");
    expect(sanitizeListingHtml("<ul><li>a</li><li>b</li></ul>")).toBe(
      "<ul><li>a</li><li>b</li></ul>",
    );
  });
  it("removes scripts, styles and iframes with their content", () => {
    expect(sanitizeListingHtml("<p>ok</p><script>alert(1)</script><style>p{}</style>")).toBe(
      "<p>ok</p>",
    );
    expect(sanitizeListingHtml('<iframe src="x"></iframe>after')).toBe("after");
  });
  it("turns other tags into text-only content", () => {
    expect(
      sanitizeListingHtml('<div><a href="javascript:x">link</a><img src=x onerror=alert(1)></div>'),
    ).toBe("link");
  });
  it("escapes an unterminated tag instead of rendering it", () => {
    expect(sanitizeListingHtml("<img src=x onerror=alert(1)")).toBe(
      "&lt;img src=x onerror=alert(1)",
    );
  });
  it("handles empty input", () => {
    expect(sanitizeListingHtml(null)).toBe("");
  });
});
