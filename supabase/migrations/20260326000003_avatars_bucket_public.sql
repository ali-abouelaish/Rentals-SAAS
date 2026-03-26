-- Ensure the avatars bucket exists and is publicly readable.
-- Without this, browser <img> requests to /object/public/avatars/... return 404
-- because the RLS "avatars read" policy calls current_tenant_id() which is only
-- set in authenticated server requests, not browser image fetches.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = true;

-- Replace the tenant-scoped read policy with an open public read
-- (safe because bucket is public and paths are not sensitive).
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read"
on storage.objects for select
using (bucket_id = 'avatars');
