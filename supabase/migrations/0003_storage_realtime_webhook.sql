-- Hero images, live updates for the review UI, and the approved-draft webhook.
create extension if not exists pg_net with schema extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hero-images', 'hero-images', false, 10485760, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

-- Object path: {brand_id}/{draft_id}.jpg. Reviewers read their brands' folders; only the service role writes.
create policy hero_images_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hero-images'
    and (select private.is_brand_member(((storage.foldername(name))[1])::uuid))
  );

alter publication supabase_realtime add table public.listing_drafts;

-- Fire the publish workflow when a reviewer approves. Target URL and secret live in Vault,
-- so this migration carries no environment specifics. Without them (local dev) it is a no-op.
create or replace function private.notify_draft_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_url text;
  secret text;
begin
  select decrypted_secret into target_url from vault.decrypted_secrets where name = 'n8n_draft_approved_url';
  select decrypted_secret into secret     from vault.decrypted_secrets where name = 'n8n_webhook_secret';
  if target_url is null then
    return new;
  end if;

  perform net.http_post(
    url := target_url,
    body := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'listing_drafts',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', to_jsonb(old)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(secret, '')
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger listing_drafts_notify_approved
  after update on public.listing_drafts
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function private.notify_draft_approved();
