-- Create property_photos storage bucket (public for image serving)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property_photos',
  'property_photos',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Public read (images embedded in listings)
drop policy if exists "property_photos read" on storage.objects;
create policy "property_photos read"
on storage.objects for select
using (bucket_id = 'property_photos');

-- Authenticated upload
drop policy if exists "property_photos insert" on storage.objects;
create policy "property_photos insert"
on storage.objects for insert
with check (
  bucket_id = 'property_photos'
  and (select auth.uid()) is not null
);

-- Authenticated update
drop policy if exists "property_photos update" on storage.objects;
create policy "property_photos update"
on storage.objects for update
using (
  bucket_id = 'property_photos'
  and (select auth.uid()) is not null
);

-- Authenticated delete
drop policy if exists "property_photos delete" on storage.objects;
create policy "property_photos delete"
on storage.objects for delete
using (
  bucket_id = 'property_photos'
  and (select auth.uid()) is not null
);
