import { Hono } from "hono";
import type { AppContext } from "../app";

/**
 * One-off helper for the Shopify authorization-code grant: Shopify redirects here with
 * `code` and `shop`; the operator exchanges the code by hand. Nothing is stored.
 */
export const oauthRoute = new Hono<AppContext>().get("/shopify/oauth/callback", (c) => {
  const code = c.req.query("code") ?? null;
  const shop = c.req.query("shop") ?? null;
  const state = c.req.query("state") ?? null;
  return c.json({ received: Boolean(code), shop, state, code });
});
