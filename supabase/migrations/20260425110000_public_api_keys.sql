-- Public API keys for external platforms reading scraped_listings (and future endpoints).
-- Plaintext key is shown to the user once at creation time and never stored;
-- only sha256(key) is persisted in key_hash.

create table if not exists public.public_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default array['scraped_listings:read']::text[],
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_public_api_keys_tenant on public.public_api_keys(tenant_id);
create index if not exists idx_public_api_keys_hash on public.public_api_keys(key_hash) where revoked_at is null;

alter table public.public_api_keys enable row level security;

create policy "public_api_keys select"
on public.public_api_keys for select
using (tenant_id = current_tenant_id());

create policy "public_api_keys insert"
on public.public_api_keys for insert
with check (tenant_id = current_tenant_id());

create policy "public_api_keys update"
on public.public_api_keys for update
using (tenant_id = current_tenant_id())
with check (tenant_id = current_tenant_id());

create policy "public_api_keys delete"
on public.public_api_keys for delete
using (tenant_id = current_tenant_id());

-- Entitlement so the dashboard nav item can be gated per tenant.
insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'public_api_access'
from public.tenants
on conflict do nothing;
