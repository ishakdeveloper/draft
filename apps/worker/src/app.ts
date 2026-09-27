import { Hono } from "hono";
import { AppError, toErrorBody } from "./lib/errors";
import { requirePipelineSecret } from "./lib/auth";
import type { Db } from "./lib/supabase";
import type { ListingGenerator } from "./lib/generator";
import { healthRoute } from "./routes/health";
import { ingestRoute } from "./routes/ingest";
import { generateRoute } from "./routes/generate";
import { failRoute } from "./routes/fail";
import { oauthRoute } from "./routes/oauth";
import { publishRoute } from "./routes/publish";
import { shopifyAdminRoute } from "./routes/shopify-admin";
import { shopifyWebhookRoute } from "./routes/shopify-webhook";
import type { FetchLike, ShopifySettings } from "./lib/shopify";

/** Everything a request handler needs. Built from env per request in index.ts, or faked in tests. */
export interface Deps {
  db: Db;
  generator: ListingGenerator;
  pipelineSecret: string;
  appVersion: string;
  shopify: ShopifySettings;
  /** Where verified Shopify product webhooks are sent (the n8n workflow). */
  productForward: { url: string; secret: string | null };
  fetchImpl: FetchLike;
}

export type AppContext = { Variables: { deps: Deps; requestId: string } };

export function createApp(makeDeps: (c: { env: unknown }) => Deps): Hono<AppContext> {
  const app = new Hono<AppContext>();

  app.use("*", async (c, next) => {
    c.set("requestId", crypto.randomUUID());
    await next();
  });

  app.onError((err, c) => {
    const { status, body } = toErrorBody(err, c.get("requestId"));
    if (status >= 500) {
      console.error(
        JSON.stringify({ message: "request failed", path: c.req.path, error: body.error }),
      );
    }
    return c.json(body, status as 400);
  });

  app.route("/", healthRoute);
  app.route("/", oauthRoute);

  const withDeps = async (c: { env: unknown; set: (key: "deps", value: Deps) => void }) => {
    try {
      const deps = makeDeps({ env: c.env });
      c.set("deps", deps);
      return deps;
    } catch (err) {
      throw new AppError("config", err instanceof Error ? err.message : String(err));
    }
  };

  // Shopify authenticates with an HMAC signature, not the pipeline secret.
  const hooks = new Hono<AppContext>();
  hooks.use("*", async (c, next) => {
    await withDeps(c);
    await next();
  });
  hooks.route("/", shopifyWebhookRoute);
  app.route("/", hooks);

  const v1 = new Hono<AppContext>();
  v1.use("*", async (c, next) => {
    const deps = await withDeps(c);
    await requirePipelineSecret(deps.pipelineSecret)(c, next);
  });
  v1.route("/", ingestRoute);
  v1.route("/", generateRoute);
  v1.route("/", failRoute);
  v1.route("/", publishRoute);
  v1.route("/", shopifyAdminRoute);
  app.route("/v1", v1);

  return app;
}
