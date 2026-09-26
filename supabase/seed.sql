-- Local and demo seed: three brands, one reviewer who belongs to two of them, sample products.
-- Reviewer login: reviewer@example.com / reviewer-password (local development only).

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token
) values (
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'reviewer@example.com', extensions.crypt('reviewer-password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"name":"Sam Reviewer"}', now(), now(), '', ''
);
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'email',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"reviewer@example.com","email_verified":true}', now(), now(), now()
);

insert into public.brands (id, slug, name, shopify_domain, shopify_vendor, default_locale, target_locales, tone_guide, visual_notes) values
(
  '10000000-0000-0000-0000-000000000001', 'lumiere-botanica', 'Lumière Botanica', 'draft-demo.myshopify.com', 'Lumière Botanica', 'en', '{de,nl,fr}',
  'Calm, botanical, quietly luxurious. Speak to a reader who reads ingredient lists. Short sentences. Never promise medical results. No exclamation marks.',
  'Soft daylight, linen textures, muted greens and warm off-white, a single plant shadow.'
),
(
  '10000000-0000-0000-0000-000000000002', 'nordkind-skin', 'Nordkind Skin', 'draft-demo.myshopify.com', 'Nordkind Skin', 'en', '{de,nl,fr}',
  'Direct, minimal, Scandinavian. Facts before feelings. Lead with the one thing the product does. Lowercase feel, but correct grammar.',
  'Cool grey light, concrete or birch surfaces, a lot of negative space, one bold accent colour.'
),
(
  '10000000-0000-0000-0000-000000000003', 'velora-wellness', 'Velora Wellness', 'draft-demo.myshopify.com', 'Velora Wellness', 'en', '{de,nl,fr}',
  'Warm, encouraging, ritual-minded. Talk about routines and moments, not miracles. Friendly, never cute.',
  'Golden hour, terracotta and sand tones, steam, hands holding the product.'
);

insert into public.brand_members (brand_id, user_id, role) values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'reviewer'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'reviewer');

-- A product that already went through the pipeline once, so the review UI is never empty.
insert into public.products (id, brand_id, shopify_product_id, shopify_gid, handle, title, body_html, vendor, product_type, tags, status, shopify_updated_at, source_hash, raw) values
(
  '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 9000000000001, 'gid://shopify/Product/9000000000001',
  'night-serum', 'Night Serum', '<p>Serum for night. Hyaluronic acid 2%, squalane, 30ml. Fragrance free.</p>',
  'Lumière Botanica', 'Serum', '{seed}', 'active', now() - interval '2 days',
  'seed-source-hash-0001',
  '{"id":9000000000001,"title":"Night Serum","vendor":"Lumière Botanica"}'
);

insert into public.listing_drafts (id, brand_id, product_id, version, status, source_hash, source_title, source_body_html, content, translations, publish_hash, model, reviewer_id, approved_at, published_at, created_at) values
(
  '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'published',
  'seed-source-hash-0001', 'Night Serum', '<p>Serum for night. Hyaluronic acid 2%, squalane, 30ml. Fragrance free.</p>',
  '{"title":"Overnight Recovery Serum","description_html":"<p>A quiet serum for the hours your skin does its repair work. Two percent hyaluronic acid draws in moisture; squalane keeps it there until morning.</p><p>Fragrance free. 30 ml.</p>","bullets":["2% hyaluronic acid for deep hydration","Plant derived squalane locks moisture in","Fragrance free, suitable for sensitive skin","30 ml glass bottle with dropper"],"seo_title":"Overnight Recovery Serum with Hyaluronic Acid","seo_description":"A fragrance free night serum with 2% hyaluronic acid and squalane. Wake to rested, hydrated skin."}',
  '{}', 'seed-publish-hash-0001', 'seed', '00000000-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '1 day', now() - interval '2 days'
);

insert into public.pipeline_events (brand_id, product_id, draft_id, step, status, duration_ms, detail) values
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ingest', 'ok', 120, '{"action":"draft_created","version":1}'),
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'generate', 'ok', 8400, '{"model":"seed"}'),
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'publish.complete', 'ok', 900, '{}');
