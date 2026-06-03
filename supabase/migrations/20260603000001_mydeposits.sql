-- mydeposits (Total Property) integration.
-- Per-tenant OAuth connection, deposit protections mirrored from the remote
-- scheme, release requests, and an API call log. Multi-tenancy uses Harbor
-- Ops' tenant_id; remote entity ids are stored as text (the API may return
-- numeric or string ids). Money is stored in pence on protections, whereas
-- property_contracts.deposit is whole pounds (convert * 100).

-- ============================================================
-- Enum: local protection lifecycle status
-- ============================================================
do $$
begin
  create type public.mydeposits_protection_status as enum (
    'draft',
    'created_remote',
    'awaiting_payment',
    'part_protected',
    'protected',
    'release_requested',
    'released',
    'disputed',
    'cancelled',
    'error'
  );
exception
  when duplicate_object then null;
end
$$;

-- ============================================================
-- 1. mydeposits_connections — one OAuth connection per tenant.
--    Tokens are AES-256-GCM ciphertext. Service-role access only
--    (mirrors tenant_gmail_connections): RLS enabled, no policies.
-- ============================================================
create table if not exists public.mydeposits_connections (
  tenant_id       uuid primary key references public.tenants(id) on delete cascade,
  environment     text not null default 'sandbox'
                    check (environment in ('sandbox','production')),
  account_label   text,
  access_token    text not null,
  refresh_token   text not null,
  token_expiry    timestamptz not null,
  connected_by    uuid references public.user_profiles(id) on delete set null,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 2. mydeposits_oauth_states — short-lived PKCE state (DB fallback
--    for the httpOnly cookie). Service-role only: RLS, no policies.
-- ============================================================
create table if not exists public.mydeposits_oauth_states (
  state          text primary key,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  code_verifier  text not null,
  expires_at     timestamptz not null,
  consumed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_mydeposits_oauth_states_expires
  on public.mydeposits_oauth_states (expires_at);

-- ============================================================
-- 3. mydeposits_protections — one row per contract being protected.
--    Remote ids captured per orchestration step so a re-run resumes.
-- ============================================================
create table if not exists public.mydeposits_protections (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  contract_id           uuid not null references public.property_contracts(id) on delete cascade,
  status                public.mydeposits_protection_status not null default 'draft',
  remote_property_id    text,
  remote_tenancy_id     text,
  remote_deposit_id     text,
  remote_payment_id     text,
  remote_landlord_id    text,
  deposit_amount_pence  integer,
  api_version           text,
  remote_deposit_status text,
  certificate_url       text,
  payment_instructions  jsonb,
  last_polled_at        timestamptz,
  last_error            text,
  created_by            uuid references public.user_profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- One protection per contract (drives idempotent upsert).
create unique index if not exists uq_mydeposits_protections_contract
  on public.mydeposits_protections (contract_id);

-- Cron polls non-terminal protections, oldest first.
create index if not exists idx_mydeposits_protections_poll
  on public.mydeposits_protections (last_polled_at)
  where status not in ('protected','released','cancelled');

create index if not exists idx_mydeposits_protections_tenant
  on public.mydeposits_protections (tenant_id, status);

-- ============================================================
-- 4. mydeposits_release_requests — release requests + settlements.
--    status/available_actions/settlements mirror the remote payloads raw.
-- ============================================================
create table if not exists public.mydeposits_release_requests (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  protection_id      uuid not null references public.mydeposits_protections(id) on delete cascade,
  remote_release_id  text,
  status             text,
  available_actions  jsonb,
  settlements        jsonb,
  last_polled_at     timestamptz,
  last_error         text,
  created_by         uuid references public.user_profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_mydeposits_release_requests_protection
  on public.mydeposits_release_requests (protection_id);

create index if not exists idx_mydeposits_release_requests_poll
  on public.mydeposits_release_requests (last_polled_at);

-- ============================================================
-- 5. mydeposits_api_log — one row per API call for debugging the
--    schema-less integration. Admin SELECT; service-role writes.
-- ============================================================
create table if not exists public.mydeposits_api_log (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenants(id) on delete cascade,
  protection_id  uuid references public.mydeposits_protections(id) on delete set null,
  method         text,
  path           text,
  status_code    integer,
  ok             boolean,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_mydeposits_api_log_tenant
  on public.mydeposits_api_log (tenant_id, created_at desc);

-- ============================================================
-- updated_at touch trigger (repo convention).
-- ============================================================
create or replace function public.mydeposits_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mydeposits_connections_set_updated_at on public.mydeposits_connections;
create trigger mydeposits_connections_set_updated_at
before update on public.mydeposits_connections
for each row execute function public.mydeposits_touch_updated_at();

drop trigger if exists mydeposits_protections_set_updated_at on public.mydeposits_protections;
create trigger mydeposits_protections_set_updated_at
before update on public.mydeposits_protections
for each row execute function public.mydeposits_touch_updated_at();

drop trigger if exists mydeposits_release_requests_set_updated_at on public.mydeposits_release_requests;
create trigger mydeposits_release_requests_set_updated_at
before update on public.mydeposits_release_requests
for each row execute function public.mydeposits_touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.mydeposits_connections      enable row level security;
alter table public.mydeposits_oauth_states      enable row level security;
alter table public.mydeposits_protections       enable row level security;
alter table public.mydeposits_release_requests  enable row level security;
alter table public.mydeposits_api_log           enable row level security;

-- mydeposits_connections / mydeposits_oauth_states: no policies — service-role only.

-- mydeposits_protections: tenant members read, admins write.
drop policy if exists "tenant_members_select_mydeposits_protections" on public.mydeposits_protections;
create policy "tenant_members_select_mydeposits_protections"
  on public.mydeposits_protections for select
  using (tenant_id = (select current_tenant_id()));

drop policy if exists "admins_all_mydeposits_protections" on public.mydeposits_protections;
create policy "admins_all_mydeposits_protections"
  on public.mydeposits_protections for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- mydeposits_release_requests: tenant members read, admins write.
drop policy if exists "tenant_members_select_mydeposits_release_requests" on public.mydeposits_release_requests;
create policy "tenant_members_select_mydeposits_release_requests"
  on public.mydeposits_release_requests for select
  using (tenant_id = (select current_tenant_id()));

drop policy if exists "admins_all_mydeposits_release_requests" on public.mydeposits_release_requests;
create policy "admins_all_mydeposits_release_requests"
  on public.mydeposits_release_requests for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- mydeposits_api_log: admins read their tenant's log; service-role writes.
drop policy if exists "admins_select_mydeposits_api_log" on public.mydeposits_api_log;
create policy "admins_select_mydeposits_api_log"
  on public.mydeposits_api_log for select
  using (tenant_id = (select current_tenant_id()) and is_admin());
