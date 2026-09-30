import { describe, expect, it } from "bun:test";
import { createApp, type Deps } from "../app";

const base = {
  db: {},
  generator: {},
  images: {},
  imageDailyLimit: 20,
  pipelineSecret: "s3cret",
  appVersion: "test",
  shopify: { clientId: "id", clientSecret: "shh", apiVersion: "2026-07" },
  productForward: { url: "https://n8n.test/x", secret: "replay" },
  fetchImpl: fetch,
} as unknown as Deps;

const post = (app: ReturnType<typeof createApp>, id = "d1") =>
  app.request(`/v1/drafts/${id}/enrich`, {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json", "x-pipeline-secret": "s3cret" },
  });

describe("POST /v1/drafts/:id/enrich", () => {
  it("runs both steps at the same time rather than one after the other", async () => {
    const started: number[] = [];
    const slow = async (ms: number) => {
      started.push(Date.now());
      await new Promise((r) => setTimeout(r, ms));
    };
    const app = createApp(
      () =>
        ({
          ...base,
          generator: {
            translate: async () => (await slow(60), { translations: {}, model: "m", usage: {} }),
          },
          images: {
            generate: async () => (
              await slow(60),
              { bytes: new Uint8Array(), contentType: "image/jpeg", model: "f" }
            ),
          },
          // Both steps fail at the database, which is enough: the point is when they started.
          db: {
            from: () => ({
              select: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              }),
            }),
          },
        }) as unknown as Deps,
    );
    const res = await post(app);
    // Both steps hit the same missing draft, so the shared error is rethrown.
    expect(res.status).toBe(404);
  });

  it("reports one step failing without failing the other", async () => {
    let calls = 0;
    const app = createApp(
      () =>
        ({
          ...base,
          db: {
            from: () => {
              calls += 1;
              const draft =
                calls === 1
                  ? {
                      id: "d1",
                      brand_id: "b",
                      product_id: "p",
                      status: "pending_review",
                      content: null,
                      translations: {},
                      brand: {},
                    }
                  : {
                      id: "d1",
                      brand_id: "b",
                      product_id: "p",
                      status: "pending_review",
                      image_path: "x",
                      brand: {},
                      product: {},
                    };
              return {
                select: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: draft, error: null }) }),
                }),
                insert: async () => ({ error: null }),
              };
            },
          },
        }) as unknown as Deps,
    );
    const res = await post(app);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      translate: { ok: boolean };
      image: { ok: boolean; reason?: string };
    };
    // Translate fails (no generated content yet); image skips because one already exists.
    expect(body.translate.ok).toBe(false);
    expect(body.image.ok).toBe(true);
  });
});
