import { Hono } from "hono";
import { contentHash, decideIngest, type DraftSummary } from "@draft/shared";
import type { AppContext } from "../app";
import { AppError } from "../lib/errors";
import { StepRecorder, findCompleted } from "../lib/events";
import { IngestRequestSchema, productGid, tagList } from "../lib/shopify-payload";
import type { Json } from "@draft/shared/database";

export const ingestRoute = new Hono<AppContext>().post("/shopify/products", async (c) => {
  const { db } = c.get("deps");
  const parsed = IngestRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation", "invalid ingest body", parsed.error.issues);
  const { topic, shop_domain, product } = parsed.data;

  const idempotencyKey = `ingest:${product.id}:${product.updated_at ?? "na"}`;
  const previous = await findCompleted(db, idempotencyKey);
  if (previous)
    return c.json({ ...(previous as object), replayed: true, request_id: c.get("requestId") });

  const recorder = new StepRecorder(db, "ingest", {}, idempotencyKey);
  const hash = await contentHash(product.title, product.body_html);

  const { data: brand, error: brandError } = await db
    .from("brands")
    .select("id, name, shopify_domain, shopify_vendor")
    .eq("shopify_vendor", product.vendor ?? "")
    .maybeSingle();
  if (brandError) throw new AppError("database", brandError.message);

  if (!brand) {
    const result = {
      action: "skipped" as const,
      reason: "brand_unknown" as const,
      vendor: product.vendor ?? null,
      shop_domain,
      topic,
    };
    await recorder.finish("skipped", result);
    return c.json({ ...result, request_id: c.get("requestId") });
  }
  recorder.attach({ brand_id: brand.id });

  const { data: productRow, error: productError } = await db
    .from("products")
    .upsert(
      {
        brand_id: brand.id,
        shopify_product_id: product.id,
        shopify_gid: productGid(product),
        handle: product.handle ?? null,
        title: product.title,
        body_html: product.body_html ?? "",
        vendor: product.vendor ?? null,
        product_type: product.product_type ?? null,
        tags: tagList(product.tags),
        status: product.status ?? null,
        shopify_updated_at: product.updated_at ?? null,
        source_hash: hash,
        raw: product as Json,
      },
      { onConflict: "brand_id,shopify_product_id" },
    )
    .select("id")
    .single();
  if (productError || !productRow)
    throw new AppError("database", productError?.message ?? "product upsert failed");
  recorder.attach({ product_id: productRow.id });

  const { data: drafts, error: draftsError } = await db
    .from("listing_drafts")
    .select("id, version, status, source_hash, publish_hash")
    .eq("product_id", productRow.id);
  if (draftsError) throw new AppError("database", draftsError.message);

  const decision = decideIngest({
    hash,
    brandFound: true,
    drafts: (drafts ?? []) as DraftSummary[],
  });

  if (decision.action === "skipped") {
    const result = {
      action: "skipped" as const,
      reason: decision.reason,
      product_id: productRow.id,
      brand_id: brand.id,
    };
    await recorder.finish("skipped", result);
    return c.json({ ...result, request_id: c.get("requestId") });
  }

  if (decision.supersedes) {
    const { error } = await db
      .from("listing_drafts")
      .update({ status: "rejected", review_note: "Superseded by a newer product edit" })
      .eq("id", decision.supersedes)
      .eq("status", "pending_review");
    if (error) throw new AppError("database", `could not supersede draft: ${error.message}`);
  }

  const { data: draft, error: draftError } = await db
    .from("listing_drafts")
    .insert({
      brand_id: brand.id,
      product_id: productRow.id,
      version: decision.version,
      status: "drafting",
      source_hash: hash,
      source_title: product.title,
      source_body_html: product.body_html ?? "",
    })
    .select("id")
    .single();
  if (draftError || !draft)
    throw new AppError("database", draftError?.message ?? "draft insert failed");
  recorder.attach({ draft_id: draft.id });

  const result = {
    action: "draft_created" as const,
    draft_id: draft.id,
    product_id: productRow.id,
    brand_id: brand.id,
    version: decision.version,
    superseded: decision.supersedes,
  };
  await recorder.finish("ok", result);
  return c.json({ ...result, request_id: c.get("requestId") });
});
