import { createHmac } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { createApp, type Deps } from "../app";
import { verifyShopifyHmac } from "../lib/shopify";

const SECRET = "shpss_test_secret";
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("base64");
const encode = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe("verifyShopifyHmac", () => {
  it("accepts Shopify's signature and rejects anything else", async () => {
    const body = '{"id":1,"title":"Toner"}';
    expect(await verifyShopifyHmac(encode(body), sign(body), SECRET)).toBe(true);
    expect(await verifyShopifyHmac(encode(body + " "), sign(body), SECRET)).toBe(false);
    expect(await verifyShopifyHmac(encode(body), null, SECRET)).toBe(false);
  });
});

function appWith(forwarded: Array<{ url: string; init: RequestInit | undefined }>, status = 200) {
  const deps = {
    db: {},
    generator: {},
    pipelineSecret: "p",
    appVersion: "t",
    shopify: { clientId: "id", clientSecret: SECRET, apiVersion: "2026-07" },
    productForward: { url: "https://n8n.test/webhook/replay-product", secret: "replay" },
    fetchImpl: async (url: string, init?: RequestInit) => {
      forwarded.push({ url, init });
      return new Response("{}", { status });
    },
  } as unknown as Deps;
  return createApp(() => deps);
}

const post = (body: string, headers: Record<string, string>) => ({
  method: "POST",
  body,
  headers: { "content-type": "application/json", ...headers },
});

describe("POST /shopify/webhooks", () => {
  const body = JSON.stringify({ id: 42, title: "Toner", vendor: "Nordkind Skin" });

  it("rejects an unsigned or wrongly signed request without forwarding", async () => {
    const forwarded: Array<{ url: string; init: RequestInit | undefined }> = [];
    const res = await appWith(forwarded).request(
      "/shopify/webhooks",
      post(body, { "x-shopify-hmac-sha256": "bad", "x-shopify-topic": "products/update" }),
    );
    expect(res.status).toBe(401);
    expect(forwarded).toHaveLength(0);
  });

  it("forwards a signed product event to n8n with the replay secret", async () => {
    const forwarded: Array<{ url: string; init: RequestInit | undefined }> = [];
    const res = await appWith(forwarded).request(
      "/shopify/webhooks",
      post(body, {
        "x-shopify-hmac-sha256": sign(body),
        "x-shopify-topic": "products/update",
        "x-shopify-shop-domain": "demo.myshopify.com",
      }),
    );
    expect(res.status).toBe(200);
    expect(forwarded).toHaveLength(1);
    const sent = forwarded[0]!;
    expect(sent.url).toBe("https://n8n.test/webhook/replay-product");
    expect(new Headers(sent.init?.headers).get("x-replay-secret")).toBe("replay");
    expect(JSON.parse(String(sent.init?.body))).toEqual({
      topic: "products/update",
      shop_domain: "demo.myshopify.com",
      product: { id: 42, title: "Toner", vendor: "Nordkind Skin" },
    });
  });

  it("ignores topics it does not handle", async () => {
    const forwarded: Array<{ url: string; init: RequestInit | undefined }> = [];
    const res = await appWith(forwarded).request(
      "/shopify/webhooks",
      post(body, { "x-shopify-hmac-sha256": sign(body), "x-shopify-topic": "orders/create" }),
    );
    expect(res.status).toBe(200);
    expect(forwarded).toHaveLength(0);
  });

  it("returns an error when n8n refuses, so Shopify retries", async () => {
    const forwarded: Array<{ url: string; init: RequestInit | undefined }> = [];
    const res = await appWith(forwarded, 503).request(
      "/shopify/webhooks",
      post(body, { "x-shopify-hmac-sha256": sign(body), "x-shopify-topic": "products/create" }),
    );
    expect(res.status).toBe(500);
  });
});
