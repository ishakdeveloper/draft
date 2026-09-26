import { Hono } from "hono";
import type { AppContext } from "../app";

export const healthRoute = new Hono<AppContext>().get("/healthz", (c) => {
  const env = c.env as { APP_VERSION?: string } | undefined;
  return c.json({ ok: true, version: env?.APP_VERSION ?? "dev", request_id: c.get("requestId") });
});
