-- Which hero image is attached to the Shopify product, so a re-publish neither duplicates it
-- nor leaves an old one behind. Written by the pipeline (service role) only.
alter table public.listing_drafts
  add column shopify_media_id text,
  add column shopify_media_path text;

comment on column public.listing_drafts.shopify_media_id is 'Shopify MediaImage id of the uploaded hero image.';
comment on column public.listing_drafts.shopify_media_path is 'The image_path that shopify_media_id was uploaded from.';
