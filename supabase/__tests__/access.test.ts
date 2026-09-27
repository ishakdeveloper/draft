/**
 * Database access rules, tested against the linked Supabase project as the seeded reviewer
 * (member of two of the three seeded brands). Every write attempted here must be refused, so
 * the suite leaves no trace and can run against the shared project. Skips without credentials.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "bun:test";
import type { Database } from "../../packages/shared/src/database.types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_REVIEWER_EMAIL;
const password = process.env.TEST_REVIEWER_PASSWORD;
const configured = Boolean(url && key && email && password);

// Seeded rows (supabase/seed.sql).
const MEMBER_DRAFT = "30000000-0000-0000-0000-000000000002"; // Nordkind Skin, pending_review
const OTHER_BRAND_DRAFT = "30000000-0000-0000-0000-000000000003"; // Velora Wellness, pending_review
const OTHER_BRAND = "10000000-0000-0000-0000-000000000003";

const client = () =>
  createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!configured)("database access", () => {
  let reviewer: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;

  beforeAll(async () => {
    anon = client();
    reviewer = client();
    const { error } = await reviewer.auth.signInWithPassword({
      email: email!,
      password: password!,
    });
    if (error) throw new Error(`test reviewer could not sign in: ${error.message}`);
  });

  it("anonymous visitors see nothing", async () => {
    for (const table of ["brands", "products", "listing_drafts", "pipeline_events"] as const) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
  });

  it("a reviewer sees only the brands they belong to", async () => {
    const { data, error } = await reviewer.from("brands").select("slug").order("slug");
    expect(error).toBeNull();
    expect(data?.map((b) => b.slug)).toEqual(["lumiere-botanica", "nordkind-skin"]);
  });

  it("a reviewer cannot read another brand's drafts or products", async () => {
    const { data: draft } = await reviewer
      .from("listing_drafts")
      .select("id")
      .eq("id", OTHER_BRAND_DRAFT);
    expect(draft).toEqual([]);
    const { data: products } = await reviewer
      .from("products")
      .select("id")
      .eq("brand_id", OTHER_BRAND);
    expect(products).toEqual([]);
  });

  it("store credentials are invisible, even to a signed-in reviewer", async () => {
    const { data } = await reviewer.from("brand_secrets").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("a reviewer cannot publish a draft themselves", async () => {
    const { error } = await reviewer
      .from("listing_drafts")
      .update({ status: "published" })
      .eq("id", MEMBER_DRAFT);
    expect(error?.message).toContain("invalid draft transition pending_review -> published");
  });

  it("a reviewer cannot write columns that belong to the pipeline", async () => {
    const { error } = await reviewer
      .from("listing_drafts")
      .update({ publish_hash: "forged" })
      .eq("id", MEMBER_DRAFT);
    expect(error?.code).toBe("42501"); // insufficient_privilege: column grant
  });

  it("a reviewer's write to another brand's draft touches nothing", async () => {
    const { data, error } = await reviewer
      .from("listing_drafts")
      .update({ status: "approved" })
      .eq("id", OTHER_BRAND_DRAFT)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a reviewer cannot create drafts or events", async () => {
    const { error: draftError } = await reviewer.from("listing_drafts").insert({
      brand_id: "10000000-0000-0000-0000-000000000002",
      product_id: "20000000-0000-0000-0000-000000000002",
      version: 99,
      source_hash: "x",
      source_title: "x",
    });
    expect(draftError).not.toBeNull();
    const { error: eventError } = await reviewer
      .from("pipeline_events")
      .insert({ step: "forged", status: "ok" });
    expect(eventError).not.toBeNull();
  });
});
