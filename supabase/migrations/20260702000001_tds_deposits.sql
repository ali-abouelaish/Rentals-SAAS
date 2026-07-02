-- TDS (Tenancy Deposit Scheme / The Dispute Service) custodial deposit lifecycle.
-- Phase 1 (20260628000001_tds_connections) added per-agency credentials. This
-- migration adds the deposits themselves: one row per contract being protected,
-- plus an API call log. Mirrors public.mydeposits_protections / mydeposits_api_log.
--
-- Unlike mydeposits' multi-step orchestration, TDS registration is a single
-- async CreateDeposit POST followed by CreateDepositStatus polling for the DAN.
-- The submitted request body is stored on the row (request_payload) with the
-- api_key stripped. Money is stored in pence (property_contracts.deposit is
-- whole pounds — convert * 100). Reuses tds_touch_updated_at() from phase 1.

-- ============================================================
-- Enum: local deposit lifecycle status
-- ============================================================
do $$
begin
  create type public.tds_deposit_status as enum (
    'draft',
    'submitted',
    'pending',
    'created',
    'failed',
    'error'
  );
exception
  when duplicate_object then null;
end
$$;

-- ============================================================
-- 1. tds_deposits — one row per contract being protected with TDS.
--    contract_id is unique (drives the idempotent upsert). The DAN lands in
--    `dan` and is mirrored onto property_contracts.deposit_scheme_ref once
--    CreateDepositStatus returns `created`.
-- ============================================================
create table if not exists public.tds_deposits (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  contract_id            uuid not null references public.property_contracts(id) on delete cascade,
  status                 public.tds_deposit_status not null default 'draft',
  batch_id               text,
  dan                    text,
  region                 text,
  scheme_type            text,
  deposit_amount_pence   integer,
  request_payload        jsonb,   -- CreateDeposit body, api_key stripped
  status_response        jsonb,   -- last CreateDepositStatus body
  warnings               jsonb,
  errors                 jsonb,
  repayment_request      jsonb,
  repayment_requested_at timestamptz,
  repayment_requested_by uuid references public.user_profiles(id) on delete set null,
  last_polled_at         timestamptz,
  last_error             text,
  created_by             uuid references public.user_profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- One deposit per contract (drives idempotent upsert on contract_id).
create unique index if not exists uq_tds_deposits_contract
  on public.tds_deposits (contract_id);

-- Cron polls non-terminal deposits, oldest poll first.
create index if not exists idx_tds_deposits_poll
  on public.tds_deposits (last_polled_at)
  where status not in ('created','failed','error');

create index if not exists idx_tds_deposits_tenant
  on public.tds_deposits (tenant_id, status);

-- ============================================================
-- 2. tds_api_log — one row per API call for debugging the schema-less
--    integration. Admin SELECT; service-role writes. Paths are stored with the
--    api_key redacted.
-- ============================================================
create table if not exists public.tds_api_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  deposit_id   uuid references public.tds_deposits(id) on delete set null,
  method       text,
  path         text,
  status_code  integer,
  ok           boolean,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_tds_api_log_tenant
  on public.tds_api_log (tenant_id, created_at desc);

-- ============================================================
-- 3. updated_at touch trigger (reuse tds_touch_updated_at() from phase 1).
-- ============================================================
drop trigger if exists tds_deposits_set_updated_at on public.tds_deposits;
create trigger tds_deposits_set_updated_at
before update on public.tds_deposits
for each row execute function public.tds_touch_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================
alter table public.tds_deposits enable row level security;
alter table public.tds_api_log  enable row level security;

-- tds_deposits: tenant members read, admins write (copied from mydeposits_protections).
drop policy if exists "tenant_members_select_tds_deposits" on public.tds_deposits;
create policy "tenant_members_select_tds_deposits"
  on public.tds_deposits for select
  using (tenant_id = (select current_tenant_id()));

drop policy if exists "admins_all_tds_deposits" on public.tds_deposits;
create policy "admins_all_tds_deposits"
  on public.tds_deposits for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- tds_api_log: admins read their tenant's log; service-role writes.
drop policy if exists "admins_select_tds_api_log" on public.tds_api_log;
create policy "admins_select_tds_api_log"
  on public.tds_api_log for select
  using (tenant_id = (select current_tenant_id()) and is_admin());
