import { describe, expect, it } from "bun:test";
import { sanitizeDetail } from "../routes/fail";

describe("sanitizeDetail", () => {
  it("drops request headers and other unknown keys", () => {
    const leaked = {
      status: 500,
      code: "ERR_BAD_RESPONSE",
      message: "500 - config",
      options: { headers: { "x-pipeline-secret": "topsecret" } },
      response: { headers: { server: "cloudflare" } },
    };
    expect(sanitizeDetail(leaked)).toEqual({
      status: 500,
      code: "ERR_BAD_RESPONSE",
      message: "500 - config",
    });
    expect(JSON.stringify(sanitizeDetail(leaked))).not.toContain("topsecret");
  });
  it("truncates long strings and passes scalars", () => {
    expect((sanitizeDetail("x".repeat(600)) as string).length).toBe(500);
    expect(sanitizeDetail(42)).toBe(42);
    expect(sanitizeDetail(undefined)).toBeNull();
  });
});
