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

/** Everything a request handler needs. Built from env per request in index.ts, or faked in tests. */
export interface Deps {
  db: Db;
  generator: ListingGenerator;
  pipelineSecret: string;
  appVersion: string;
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

  const v1 = new Hono<AppContext>();
  v1.use("*", async (c, next) => {
    let deps: Deps;
    try {
      deps = makeDeps({ env: c.env });
    } catch (err) {
      throw new AppError("config", err instanceof Error ? err.message : String(err));
    }
    c.set("deps", deps);
    await requirePipelineSecret(deps.pipelineSecret)(c, next);
  });
  v1.route("/", ingestRoute);
  v1.route("/", generateRoute);
  v1.route("/", failRoute);
  app.route("/v1", v1);

  return app;
}
