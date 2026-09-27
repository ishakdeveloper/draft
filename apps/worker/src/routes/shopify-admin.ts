import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { WEBHOOK_CREATE, getAccessToken, shopifyGraphql } from "../lib/shopify";

const BodySchema = z.object({ shop_domain: z.string().min(1), callback_url: z.url() });

interface WebhookCreateData {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string; topic: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

/** One-off setup: subscribe the shop's product webhooks to this Worker. Re-running is harmless. */
export const shopifyAdminRoute = new Hono<AppContext>().post(
  "/shopify/webhooks/register",
  async (c) => {
    const { db, shopify, fetchImpl } = c.get("deps");
    const parsed = BodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new AppError("validation", "invalid body", parsed.error.issues);
    const { shop_domain, callback_url } = parsed.data;

    const { data: brand, error } = await db
      .from("brands")
      .select("id, shopify_domain")
      .eq("shopify_domain", shop_domain)
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError("database", error.message);
    if (!brand) throw new AppError("brand_unknown", `no brand is connected to ${shop_domain}`);

    const token = await getAccessToken(db, brand, shopify, fetchImpl);
    const results = [];
    for (const topic of ["PRODUCTS_CREATE", "PRODUCTS_UPDATE"]) {
      const { data } = await shopifyGraphql<WebhookCreateData>(
        shop_domain,
        token,
        shopify.apiVersion,
        WEBHOOK_CREATE,
        { topic, sub: { uri: callback_url } },
        fetchImpl,
      );
      const r = data.webhookSubscriptionCreate;
      const taken = r.userErrors.some((e) => /taken|already/i.test(e.message));
      results.push({
        topic,
        id: r.webhookSubscription?.id ?? null,
        status: r.webhookSubscription ? "created" : taken ? "exists" : "error",
        errors: taken ? [] : r.userErrors,
      });
    }
    return c.json({ shop_domain, results, request_id: c.get("requestId") });
  },
);
