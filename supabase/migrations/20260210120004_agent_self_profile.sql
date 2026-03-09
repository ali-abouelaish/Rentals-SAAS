-- Allow agents to update their own agent_profile (avatar_url, etc.)
drop policy if exists "tenant can update agents" on agent_profiles;
create policy "tenant can update agents"
on agent_profiles for update
using (
  tenant_id = current_tenant_id()
  and (is_admin() or user_id = auth.uid())
);

-- Avatars bucket: path must be tenant_id/user_id/... (first folder tenant, second folder = auth.uid())
-- Restrict insert so users can only upload to their own folder
drop policy if exists "avatars write" on storage.objects;
create policy "avatars write"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = current_tenant_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow agents to update/delete their own avatar in storage (path: tenant_id/user_id/...)
create policy "avatars update"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = current_tenant_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "avatars delete"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = current_tenant_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);
