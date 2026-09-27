import "server-only";
import type { DraftStatus } from "@draft/shared";
import { createClient } from "@/lib/supabase/server";

/** Server-side reads. Every query runs as the signed-in reviewer, so RLS decides what comes back. */

export async function listBrands() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("brands").select("id, slug, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function countDraftsByStatus(brandId: string | null) {
  const supabase = await createClient();
  let query = supabase.from("listing_drafts").select("status");
  if (brandId) query = query.eq("brand_id", brandId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const counts = new Map<DraftStatus, number>();
  for (const row of data) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return counts;
}

export async function listDrafts(status: DraftStatus, brandId: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("listing_drafts")
    .select(
      "id, status, version, created_at, updated_at, model, content, brand:brands(id, name, slug), product:products(title, product_type)",
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  if (brandId) query = query.eq("brand_id", brandId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getDraft(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_drafts")
    .select(
      "id, status, version, created_at, updated_at, model, content, translations, image_path, review_note, error, approved_at, rejected_at, published_at, brand:brands(id, name, slug, default_locale, target_locales, tone_guide), product:products(title, body_html, handle, product_type, tags, shopify_gid)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type DraftDetail = NonNullable<Awaited<ReturnType<typeof getDraft>>>;

export async function listEvents(draftId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_events")
    .select("id, step, status, duration_ms, created_at, detail")
    .eq("draft_id", draftId)
    .order("id", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return data;
}

export type PipelineEvent = Awaited<ReturnType<typeof listEvents>>[number];

/** Signed with the reviewer's session, so Storage RLS confirms brand membership. */
export async function heroImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("hero-images").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
