-- Tenant communication requests
--
-- Public preferences page submissions. The page itself is unauthenticated
-- (signed token), but the table is server-only writable via the admin client
-- and read-only for agency members via RLS.

create table if not exists public.tenant_communication_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pm_tenant_id uuid not null references public.pm_tenants(id) on delete cascade,
  request_type text not null check (request_type in
    ('email_change','alternative_format','data_access','other')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','completed')),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create index if not exists tenant_communication_requests_status_idx
  on public.tenant_communication_requests (tenant_id, status, created_at desc);
create index if not exists tenant_communication_requests_pm_tenant_idx
  on public.tenant_communication_requests (pm_tenant_id, created_at desc);

alter table public.tenant_communication_requests enable row level security;

-- Agency members may read and update their own agency's requests.
-- Inserts come from the public preferences page through the admin client,
-- so no insert policy is granted to authenticated users.
create policy "Agency members can read communication requests"
  on public.tenant_communication_requests
  for select
  using (
    tenant_id in (
      select tenant_id from public.user_profiles where id = (select auth.uid())
    )
  );

create policy "Agency members can update communication requests"
  on public.tenant_communication_requests
  for update
  using (
    tenant_id in (
      select tenant_id from public.user_profiles where id = (select auth.uid())
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.user_profiles where id = (select auth.uid())
    )
  );
