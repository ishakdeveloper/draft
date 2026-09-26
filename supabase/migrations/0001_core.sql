-- Core schema: brands, products, listing drafts, pipeline events.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create type public.draft_status as enum (
  'drafting', 'pending_review', 'approved', 'rejected', 'published', 'failed'
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  shopify_domain text not null,
  shopify_vendor text not null unique,
  default_locale text not null default 'en',
  target_locales text[] not null default '{de,nl,fr}',
  tone_guide text not null,
  visual_notes text not null default '',
  created_at timestamptz not null default now()
);
comment on table public.brands is 'One row per brand. shopify_vendor maps a product''s vendor field to the brand.';

-- Service-role only: RLS is enabled with no policies.
create table public.brand_secrets (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  shopify_client_id text,
  shopify_client_secret text,
  shopify_access_token text,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.brand_members (
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'reviewer' check (role in ('reviewer', 'admin')),
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index brand_members_user_id_idx on public.brand_members (user_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  shopify_product_id bigint not null,
  shopify_gid text not null,
  handle text,
  title text not null,
  body_html text not null default '',
  vendor text,
  product_type text,
  tags text[] not null default '{}',
  status text,
  shopify_updated_at timestamptz,
  source_hash text not null,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, shopify_product_id)
);
create index products_brand_id_idx on public.products (brand_id);

create table public.listing_drafts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  product_id uuid not null references public.products (id) on delete cascade,
  version int not null,
  status public.draft_status not null default 'drafting',
  source_hash text not null,
  source_title text not null,
  source_body_html text not null default '',
  content jsonb,
  translations jsonb not null default '{}'::jsonb,
  image_path text,
  image_prompt text,
  publish_hash text,
  model text,
  reviewer_id uuid references auth.users (id),
  review_note text,
  approved_at timestamptz,
  rejected_at timestamptz,
  published_at timestamptz,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, version)
);
create index listing_drafts_brand_status_idx on public.listing_drafts (brand_id, status, created_at desc);
create index listing_drafts_product_id_idx on public.listing_drafts (product_id);
create index listing_drafts_reviewer_id_idx on public.listing_drafts (reviewer_id) where reviewer_id is not null;
create unique index listing_drafts_one_open_per_product
  on public.listing_drafts (product_id)
  where status in ('drafting', 'pending_review', 'approved');

create table public.pipeline_events (
  id bigint generated always as identity primary key,
  brand_id uuid references public.brands (id),
  product_id uuid references public.products (id) on delete cascade,
  draft_id uuid references public.listing_drafts (id) on delete cascade,
  step text not null,
  status text not null check (status in ('started', 'ok', 'skipped', 'error')),
  idempotency_key text,
  duration_ms int,
  detail jsonb,
  created_at timestamptz not null default now()
);
create unique index pipeline_events_idempotency_key_idx
  on public.pipeline_events (idempotency_key) where idempotency_key is not null;
create index pipeline_events_draft_id_idx on public.pipeline_events (draft_id, created_at);
create index pipeline_events_brand_id_idx on public.pipeline_events (brand_id, created_at desc);
create index pipeline_events_product_id_idx on public.pipeline_events (product_id);

-- updated_at bookkeeping for products (drafts get it in the transition trigger).
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();
create trigger brand_secrets_set_updated_at
  before update on public.brand_secrets
  for each row execute function private.set_updated_at();

-- Status transitions. Mirrors ALLOWED_TRANSITIONS in packages/shared/src/transitions.ts.
-- A signed-in reviewer may only approve or reject; the pipeline (service role) does the rest.
create or replace function private.enforce_draft_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  new.updated_at := now();
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'drafting'       and new.status in ('pending_review', 'failed')) or
    (old.status = 'pending_review' and new.status in ('approved', 'rejected')) or
    (old.status = 'approved'       and new.status in ('published', 'failed'))
  ) then
    raise exception 'invalid draft transition % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if actor is not null then
    if new.status not in ('approved', 'rejected') then
      raise exception 'reviewers may only approve or reject a draft'
        using errcode = 'insufficient_privilege';
    end if;
    new.reviewer_id := actor;
  end if;

  if new.status = 'approved' then new.approved_at := now(); end if;
  if new.status = 'rejected' then new.rejected_at := now(); end if;
  if new.status = 'published' then new.published_at := now(); end if;
  return new;
end;
$$;
create trigger listing_drafts_transition
  before update on public.listing_drafts
  for each row execute function private.enforce_draft_transition();
