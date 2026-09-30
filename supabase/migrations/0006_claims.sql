-- The claim check: every factual statement in a generated listing, with whether the source
-- actually supports it. Written by the pipeline only; reviewers read it.
alter table public.listing_drafts
  add column claims jsonb,
  add column claims_checked_at timestamptz;

comment on column public.listing_drafts.claims is
  'VerifiedClaim[]: the checking model''s verdict per statement, plus our own verbatim check of the cited span.';
