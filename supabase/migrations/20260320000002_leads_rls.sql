-- RLS policies for leads feature tables.

alter table public.tenant_gmail_connections enable row level security;
alter table public.tenant_platform_configs enable row level security;
alter table public.leads enable row level security;

-- Gmail connections: admin-only
create policy "gmail connections select"
  on public.tenant_gmail_connections for select
  using (tenant_id = current_tenant_id() and is_admin());

create policy "gmail connections insert"
  on public.tenant_gmail_connections for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "gmail connections update"
  on public.tenant_gmail_connections for update
  using (tenant_id = current_tenant_id() and is_admin());

create policy "gmail connections delete"
  on public.tenant_gmail_connections for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- Platform configs: admin-only
create policy "platform configs select"
  on public.tenant_platform_configs for select
  using (tenant_id = current_tenant_id() and is_admin());

create policy "platform configs insert"
  on public.tenant_platform_configs for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "platform configs update"
  on public.tenant_platform_configs for update
  using (tenant_id = current_tenant_id() and is_admin());

create policy "platform configs delete"
  on public.tenant_platform_configs for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- Leads: all tenant members can read/write; only admins can delete
create policy "leads select"
  on public.leads for select
  using (tenant_id = current_tenant_id());

create policy "leads insert"
  on public.leads for insert
  with check (tenant_id = current_tenant_id());

create policy "leads update"
  on public.leads for update
  using (tenant_id = current_tenant_id());

create policy "leads delete"
  on public.leads for delete
  using (tenant_id = current_tenant_id() and is_admin());
