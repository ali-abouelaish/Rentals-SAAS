-- DPS deposit lifecycle, phase 2 (phase 1 = 20260707000001_dps_connections).
-- One row per contract being protected with DPS, plus an API call log.
-- Mirrors tds_deposits / tds_api_log with a simpler state machine: DPS has no
-- status/read endpoints, so there is no polling — every transition is driven
-- by a user action, and "protected" can only be recorded manually after the
-- agency confirms it in the DPS portal.
--
--   draft → submitted → created → marked_for_transfer → protected
--                 └→ failed / error ┘
--
-- created            = DPS returned a depositId (tenancy registered, awaiting
--                      deposit payment). depositId is mirrored onto
--                      property_contracts.deposit_scheme_ref.
-- marked_for_transfer = MarkForBankTransfer accepted; paymentReference stored.
-- protected          = manually confirmed by an admin from the DPS portal.
-- failed             = DPS rejected the request (400 validation).
-- error              = transport/unexpected failure; retryable.
-- Money is stored in pence (property_contracts.deposit is whole pounds).
-- Reuses dps_touch_updated_at() from phase 1.

-- ============================================================
-- Enum: local deposit lifecycle status
-- ============================================================
do $$
begin
  create type public.dps_deposit_status as enum (
    'draft',
    'submitted',
    'created',
    'marked_for_transfer',
    'protected',
    'failed',
    'error'
  );
exception
  when duplicate_object then null;
end
$$;

-- ============================================================
-- 1. dps_deposits — one row per contract being protected with DPS.
-- ============================================================
create table if not exists public.dps_deposits (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  contract_id            uuid not null references public.property_contracts(id) on delete cascade,
  status                 public.dps_deposit_status not null default 'draft',
  deposit_id             text,      -- 8-digit DPS deposit id from tenancy create
  allocation_reference   text,      -- agent-chosen batch reference (1-18 alphanum)
  payment_reference      text,      -- DPS-returned reference for the bank transfer
  request_id             text,      -- DPS requestId (support handle, success or failure)
  deposit_amount_pence   integer,
  request_payload        jsonb,     -- outbound create body (contains no secrets)
  errors                 jsonb,     -- parsed error.details[] from the last failure
  protected_confirmed_at timestamptz,
  protected_confirmed_by uuid references public.user_profiles(id) on delete set null,
  last_error             text,
  created_by             uuid references public.user_profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- One deposit per contract (drives idempotent upsert on contract_id).
create unique index if not exists uq_dps_deposits_contract
  on public.dps_deposits (contract_id);

create index if not exists idx_dps_deposits_tenant
  on public.dps_deposits (tenant_id, status);

-- ============================================================
-- 2. dps_api_log — one row per API call for debugging. Admin SELECT;
--    service-role writes.
-- ============================================================
create table if not exists public.dps_api_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  deposit_id   uuid references public.dps_deposits(id) on delete set null,
  method       text,
  path         text,
  status_code  integer,
  ok           boolean,
  request_id   text,     -- DPS requestId for support escalation
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_dps_api_log_tenant
  on public.dps_api_log (tenant_id, created_at desc);

-- ============================================================
-- 3. updated_at touch trigger (reuse dps_touch_updated_at() from phase 1).
-- ============================================================
drop trigger if exists dps_deposits_set_updated_at on public.dps_deposits;
create trigger dps_deposits_set_updated_at
before update on public.dps_deposits
for each row execute function public.dps_touch_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================
alter table public.dps_deposits enable row level security;
alter table public.dps_api_log  enable row level security;

-- dps_deposits: tenant members read, admins write (copied from tds_deposits).
drop policy if exists "tenant_members_select_dps_deposits" on public.dps_deposits;
create policy "tenant_members_select_dps_deposits"
  on public.dps_deposits for select
  using (tenant_id = (select current_tenant_id()));

drop policy if exists "admins_all_dps_deposits" on public.dps_deposits;
create policy "admins_all_dps_deposits"
  on public.dps_deposits for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- dps_api_log: admins read their tenant's log; service-role writes.
drop policy if exists "admins_select_dps_api_log" on public.dps_api_log;
create policy "admins_select_dps_api_log"
  on public.dps_api_log for select
  using (tenant_id = (select current_tenant_id()) and is_admin());
