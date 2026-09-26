import { describe, expect, it } from "bun:test";
import { createApp, type Deps } from "../app";

const deps = {
  db: {},
  generator: {},
  pipelineSecret: "s3cret",
  appVersion: "test",
} as unknown as Deps;
const app = createApp(() => deps);

describe("app", () => {
  it("serves healthz without a secret", async () => {
    const res = await app.request("/healthz", {}, { APP_VERSION: "1.2.3" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; version: string };
    expect(body.ok).toBe(true);
    expect(body.version).toBe("1.2.3");
  });
  it("rejects v1 routes without the pipeline secret", async () => {
    const res = await app.request("/v1/shopify/products", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string }; request_id: string };
    expect(body.error.code).toBe("unauthorized");
    expect(body.request_id).toBeTruthy();
  });
  it("reports a config error when deps cannot be built", async () => {
    const broken = createApp(() => {
      throw new Error("missing secrets: X");
    });
    const res = await broken.request("/v1/drafts/1/fail", { method: "POST", body: "{}" });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("config");
  });
  it("echoes the oauth callback without storing anything", async () => {
    const res = await app.request("/shopify/oauth/callback?code=abc&shop=x.myshopify.com");
    expect((await res.json()) as object).toEqual({
      received: true,
      shop: "x.myshopify.com",
      state: null,
      code: "abc",
    });
  });
});
