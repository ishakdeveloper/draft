import { describe, expect, it } from "bun:test";
import { containsVerbatim, plainText, unverifiedClaims, verifyClaims, type Claim } from "../claims";

const claim = (over: Partial<Claim> = {}): Claim => ({
  field: "description_html",
  text: "Some sentence.",
  supported: true,
  source_span: null,
  note: null,
  ...over,
});

const source = "<p>balm. cloudberry seed oil, shea butter, beeswax. 45 g tin. unscented</p>";

describe("plainText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(plainText("<p>a  <strong>b</strong>\n c</p>")).toBe("a b c");
  });
  it("handles entities and empty input", () => {
    expect(plainText("shea &amp; beeswax")).toBe("shea & beeswax");
    expect(plainText(null)).toBe("");
  });
});

describe("containsVerbatim", () => {
  it("finds a span regardless of case, whitespace and surrounding tags", () => {
    expect(containsVerbatim(source, "Cloudberry Seed Oil")).toBe(true);
    expect(containsVerbatim(source, "<em>45 g   tin</em>")).toBe(true);
  });
  it("rejects a span the source never contained", () => {
    expect(containsVerbatim(source, "clinically proven")).toBe(false);
  });
  it("treats an empty or missing span as not found", () => {
    expect(containsVerbatim(source, "")).toBe(false);
    expect(containsVerbatim(source, null)).toBe(false);
  });
});

describe("verifyClaims", () => {
  it("accepts a supported claim whose span is really in the source", () => {
    const [result] = verifyClaims([claim({ source_span: "45 g tin" })], source);
    expect(result!.verified).toBe(true);
  });

  it("rejects a claim the model called supported but could not quote", () => {
    // The real failure this exists for: the model invented "Three ingredients" for the
    // Cloudberry listing, and the source never said it.
    const invented = claim({
      text: "Three ingredients.",
      supported: true,
      source_span: "three ingredients",
    });
    const [result] = verifyClaims([invented], source);
    expect(result!.verified).toBe(false);
  });

  it("never promotes a claim the model itself called unsupported", () => {
    const [result] = verifyClaims([claim({ supported: false, source_span: "45 g tin" })], source);
    expect(result!.verified).toBe(false);
  });

  it("rejects a supported claim with no span at all", () => {
    const [result] = verifyClaims([claim({ supported: true, source_span: null })], source);
    expect(result!.verified).toBe(false);
  });

  it("collects the ones a reviewer has to look at", () => {
    const checked = verifyClaims(
      [
        claim({ text: "ok", source_span: "beeswax" }),
        claim({ text: "invented", source_span: "dermatologist tested" }),
      ],
      source,
    );
    expect(unverifiedClaims(checked).map((c) => c.text)).toEqual(["invented"]);
  });
});
