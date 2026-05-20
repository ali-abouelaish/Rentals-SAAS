-- ============================================================
-- Bank Statement Uploads — schema, indexes, RLS
-- ============================================================
-- Lets an agency upload a portfolio's bank statement (CSV/PDF),
-- auto-detects the bank, parses transactions, matches credits to
-- property_contracts, and flags missing rent per landlord.
--
-- Spec name mapping (external spec → Harbor Ops):
--   agency_id          → tenant_id
--   landlord_id        → portfolio_id  (the portfolio whose
--                        statement is being uploaded — replaces
--                        the original per-landlord scoping)
--   contracts          → property_contracts
--   tenants (renter)   → pm_tenants
--   property.address   → properties.address_line_1
-- ============================================================

-- ─── bank_statement_uploads ────────────────────────────────
create table if not exists public.bank_statement_uploads (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  portfolio_id        uuid references public.portfolios(id) on delete set null,
  filename            text not null,
  bank_name           text check (bank_name in ('barclays','hsbc','lloyds','natwest','santander','unknown')),
  file_format         text check (file_format in ('csv','pdf')),
  statement_from      date,
  statement_to        date,
  total_credits       integer not null default 0,
  status              text not null default 'pending'
                        check (status in ('pending','parsed','failed')),
  error_message       text,
  uploaded_at         timestamptz not null default now()
);

create index if not exists bank_statement_uploads_tenant_idx
  on public.bank_statement_uploads(tenant_id, uploaded_at desc);
create index if not exists bank_statement_uploads_portfolio_idx
  on public.bank_statement_uploads(portfolio_id);

-- ─── bank_transactions ─────────────────────────────────────
create table if not exists public.bank_transactions (
  id                  uuid primary key default gen_random_uuid(),
  upload_id           uuid not null references public.bank_statement_uploads(id) on delete cascade,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  transaction_date    date not null,
  description         text,
  amount_pence        integer not null,
  transaction_type    text not null check (transaction_type in ('credit','debit')),
  balance_pence       integer,
  reference           text,
  match_status        text not null default 'unmatched'
                        check (match_status in ('unmatched','matched','flagged')),
  matched_contract_id uuid references public.property_contracts(id) on delete set null,
  matched_tenant_name text,
  raw_row             jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists bank_transactions_upload_idx
  on public.bank_transactions(upload_id, transaction_date desc);
create index if not exists bank_transactions_tenant_idx
  on public.bank_transactions(tenant_id);
create index if not exists bank_transactions_match_idx
  on public.bank_transactions(matched_contract_id)
  where matched_contract_id is not null;

-- ─── rent_payment_flags ────────────────────────────────────
create table if not exists public.rent_payment_flags (
  id                      uuid primary key default gen_random_uuid(),
  upload_id               uuid not null references public.bank_statement_uploads(id) on delete cascade,
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  contract_id             uuid not null references public.property_contracts(id) on delete cascade,
  manager_landlord_id     uuid references public.manager_landlords(id) on delete set null,
  landlord_name           text,
  portfolio_id            uuid references public.portfolios(id) on delete set null,
  portfolio_name          text,
  tenant_name             text,
  property_address        text,
  expected_amount_pence   integer,
  flag_type               text not null default 'missing_rent',
  resolved                boolean not null default false,
  resolved_at             timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists rent_payment_flags_upload_idx
  on public.rent_payment_flags(upload_id);
create index if not exists rent_payment_flags_tenant_idx
  on public.rent_payment_flags(tenant_id);
create index if not exists rent_payment_flags_open_idx
  on public.rent_payment_flags(tenant_id)
  where resolved = false;

-- ─── RLS ───────────────────────────────────────────────────
alter table public.bank_statement_uploads enable row level security;
alter table public.bank_transactions      enable row level security;
alter table public.rent_payment_flags     enable row level security;

-- bank_statement_uploads
drop policy if exists "bank_statement_uploads select" on public.bank_statement_uploads;
create policy "bank_statement_uploads select" on public.bank_statement_uploads
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "bank_statement_uploads insert" on public.bank_statement_uploads;
create policy "bank_statement_uploads insert" on public.bank_statement_uploads
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "bank_statement_uploads update" on public.bank_statement_uploads;
create policy "bank_statement_uploads update" on public.bank_statement_uploads
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "bank_statement_uploads delete" on public.bank_statement_uploads;
create policy "bank_statement_uploads delete" on public.bank_statement_uploads
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));

-- bank_transactions
drop policy if exists "bank_transactions select" on public.bank_transactions;
create policy "bank_transactions select" on public.bank_transactions
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "bank_transactions insert" on public.bank_transactions;
create policy "bank_transactions insert" on public.bank_transactions
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "bank_transactions update" on public.bank_transactions;
create policy "bank_transactions update" on public.bank_transactions
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "bank_transactions delete" on public.bank_transactions;
create policy "bank_transactions delete" on public.bank_transactions
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));

-- rent_payment_flags
drop policy if exists "rent_payment_flags select" on public.rent_payment_flags;
create policy "rent_payment_flags select" on public.rent_payment_flags
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "rent_payment_flags insert" on public.rent_payment_flags;
create policy "rent_payment_flags insert" on public.rent_payment_flags
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "rent_payment_flags update" on public.rent_payment_flags;
create policy "rent_payment_flags update" on public.rent_payment_flags
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "rent_payment_flags delete" on public.rent_payment_flags;
create policy "rent_payment_flags delete" on public.rent_payment_flags
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));
