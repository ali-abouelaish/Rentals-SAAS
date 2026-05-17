-- Enable Banking AIS sandbox demo.
-- Three tables that mirror EB's connect → accounts → transactions flow.
-- Multi-tenancy uses Harbor Ops' tenant_id (not the brief's "agency_id").
-- Match status references property_contracts.id (sandbox heuristic only).

-- ============================================================
-- 1. ob_connections — one row per EB authorization session
-- ============================================================
create table if not exists public.ob_connections (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  eb_session_id         text,
  eb_authorization_id   text,
  aspsp_name            text,
  aspsp_country         text default 'GB',
  status                text not null default 'pending'
                          check (status in ('pending','authorized','expired')),
  valid_until           timestamptz,
  created_at            timestamptz not null default now()
);

create index on public.ob_connections (tenant_id, status, created_at desc);

-- ============================================================
-- 2. ob_accounts — bank accounts exposed by an authorized session
-- ============================================================
create table if not exists public.ob_accounts (
  id               uuid primary key default gen_random_uuid(),
  connection_id    uuid not null references public.ob_connections(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  eb_account_uid   text not null,
  iban             text,
  account_name     text,
  currency         text,
  last_synced_at   timestamptz,
  unique (connection_id, eb_account_uid)
);

create index on public.ob_accounts (tenant_id);

-- ============================================================
-- 3. ob_transactions — booked transactions pulled from EB
-- amount_pence is the absolute value; credit_debit carries the sign.
-- matched_payment_id holds a property_contracts.id (matches.rent_pcm
-- within ±£5) for the sandbox auto-match heuristic.
-- ============================================================
create table if not exists public.ob_transactions (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.ob_accounts(id) on delete cascade,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  eb_transaction_id   text unique,
  booking_date        date,
  amount_pence        integer,
  currency            text,
  credit_debit        text check (credit_debit in ('CRDT','DBIT')),
  debtor_name         text,
  remittance_info     text,
  match_status        text not null default 'unmatched'
                        check (match_status in ('unmatched','matched','flagged')),
  matched_payment_id  uuid references public.property_contracts(id) on delete set null,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);

create index on public.ob_transactions (account_id, booking_date desc);
create index on public.ob_transactions (tenant_id, match_status, booking_date desc);

-- ============================================================
-- Row Level Security — same pattern as the rest of the app:
-- members can read their tenant's rows, admins can write.
-- ============================================================
alter table public.ob_connections  enable row level security;
alter table public.ob_accounts     enable row level security;
alter table public.ob_transactions enable row level security;

-- ob_connections
create policy "tenant_members_select_ob_connections"
  on public.ob_connections for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_ob_connections"
  on public.ob_connections for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ob_accounts
create policy "tenant_members_select_ob_accounts"
  on public.ob_accounts for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_ob_accounts"
  on public.ob_accounts for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ob_transactions
create policy "tenant_members_select_ob_transactions"
  on public.ob_transactions for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_ob_transactions"
  on public.ob_transactions for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());
