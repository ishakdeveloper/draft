import { describe, expect, it } from "bun:test";
import { secretsMatch } from "../lib/auth";

describe("secretsMatch", () => {
  it("matches equal secrets", async () => {
    expect(await secretsMatch("abc123", "abc123")).toBe(true);
  });
  it("rejects different secrets, including different lengths", async () => {
    expect(await secretsMatch("abc123", "abc124")).toBe(false);
    expect(await secretsMatch("", "abc")).toBe(false);
  });
});
