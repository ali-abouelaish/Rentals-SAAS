-- Tenant-level feature entitlements with optional end date.

create table if not exists public.tenant_feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null,
  is_enabled boolean not null default true,
  ends_on date,
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature_key)
);

create index if not exists idx_tenant_feature_entitlements_tenant
  on public.tenant_feature_entitlements (tenant_id);

create index if not exists idx_tenant_feature_entitlements_feature
  on public.tenant_feature_entitlements (feature_key);

