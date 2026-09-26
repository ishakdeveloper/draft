-- Row level security: reviewers see and act on their brands only. The service role bypasses RLS.
create or replace function private.is_brand_member(brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brand_members m
    where m.brand_id = brand
      and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_brand_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_brand_member(uuid) to authenticated;

alter table public.brands enable row level security;
create policy brands_select_member on public.brands
  for select to authenticated
  using ((select private.is_brand_member(id)));

alter table public.brand_secrets enable row level security;
-- no policies: invisible to anon and authenticated

alter table public.brand_members enable row level security;
create policy brand_members_select_self on public.brand_members
  for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.products enable row level security;
create policy products_select_member on public.products
  for select to authenticated
  using ((select private.is_brand_member(brand_id)));

alter table public.listing_drafts enable row level security;
create policy listing_drafts_select_member on public.listing_drafts
  for select to authenticated
  using ((select private.is_brand_member(brand_id)));
create policy listing_drafts_review on public.listing_drafts
  for update to authenticated
  using ((select private.is_brand_member(brand_id)) and status = 'pending_review')
  with check ((select private.is_brand_member(brand_id)) and status in ('pending_review', 'approved', 'rejected'));

-- Reviewers may edit the listing and decide; every other column belongs to the pipeline.
revoke update on public.listing_drafts from authenticated;
grant update (status, content, translations, review_note) on public.listing_drafts to authenticated;

alter table public.pipeline_events enable row level security;
create policy pipeline_events_select_member on public.pipeline_events
  for select to authenticated
  using ((select private.is_brand_member(brand_id)));

-- Nothing here is writable by anon.
revoke all on all tables in schema public from anon;
