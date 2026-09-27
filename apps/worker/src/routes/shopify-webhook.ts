import { Hono } from "hono";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { requireShopifyCredentials, verifyShopifyHmac } from "../lib/shopify";

const HANDLED_TOPICS = new Set(["products/create", "products/update"]);

/**
 * Shopify posts product webhooks here. The body is verified against the app secret, then
 * handed to n8n, which runs the pipeline. A non-2xx response makes Shopify retry.
 */
export const shopifyWebhookRoute = new Hono<AppContext>().post("/shopify/webhooks", async (c) => {
  const { shopify, productForward, fetchImpl } = c.get("deps");
  const { clientSecret } = requireShopifyCredentials(shopify);

  const raw = await c.req.arrayBuffer();
  if (!(await verifyShopifyHmac(raw, c.req.header("x-shopify-hmac-sha256"), clientSecret))) {
    throw new AppError("unauthorized", "invalid Shopify webhook signature");
  }

  const topic = c.req.header("x-shopify-topic") ?? "";
  const shop = c.req.header("x-shopify-shop-domain") ?? "";
  if (!HANDLED_TOPICS.has(topic)) return c.json({ ignored: topic, request_id: c.get("requestId") });

  if (!productForward.secret) throw new AppError("config", "REPLAY_SECRET is not set");
  const product = JSON.parse(new TextDecoder().decode(raw)) as unknown;
  const res = await fetchImpl(productForward.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-replay-secret": productForward.secret },
    body: JSON.stringify({ topic, shop_domain: shop, product }),
  });
  if (!res.ok) throw new AppError("internal", `n8n rejected the event (${res.status})`);

  console.log(
    JSON.stringify({
      message: "shopify webhook forwarded",
      topic,
      shop,
      webhook_id: c.req.header("x-shopify-webhook-id"),
    }),
  );
  return c.json({ forwarded: true, request_id: c.get("requestId") });
});
