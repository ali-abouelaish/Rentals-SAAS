-- ============================================================
-- Owner statements & ledger.
-- ============================================================
-- A managing-agent owner statement: per owner, per period, the
-- rent collected on their behalf, less the agency's management
-- fee, works-order costs and other deductions, arriving at a net
-- amount paid to the owner — with an opening/closing balance
-- carried period to period. This is the OWNER's perspective (rent
-- is the owner's income, the agency fee a deduction), the mirror
-- image of the agency-side finance_entries P&L.
--
--   owner_statements    — one period document per (owner, month).
--   owner_transactions  — the ledger lines a statement draws from,
--                         auto-derived from rent_payments and
--                         maintenance_costs plus a computed fee
--                         line, with manual adjustments on top.
--
-- Owner = existing owner_landlords (single owner per property via
-- properties.owner_landlord_id). Money is INTEGER PENCE, matching
-- finance_entries (rent_payments.amount, in pounds, is converted
-- at generation time).
-- ============================================================

-- ─── owner_statements ──────────────────────────────────────
create table public.owner_statements (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  owner_id                    uuid not null references public.owner_landlords(id) on delete cascade,
  period_year                 int  not null,
  period_month                int  not null check (period_month between 1 and 12),
  period_start                date not null,
  period_end                  date not null,
  opening_balance_pence       integer not null default 0,
  closing_balance_pence       integer not null default 0,
  total_rent_received_pence   integer not null default 0,
  total_management_fee_pence  integer not null default 0,
  total_works_pence           integer not null default 0,
  total_other_pence           integer not null default 0,
  net_to_owner_pence          integer not null default 0,
  status                      text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'void')),
  -- Storage path inside the private owner-statements-pdf bucket (read via signed URL).
  pdf_storage_path            text,
  sent_at                     timestamptz,
  generated_at                timestamptz not null default now(),
  created_by                  uuid references public.user_profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  -- One statement per owner per period; makes monthly generation idempotent.
  unique (tenant_id, owner_id, period_year, period_month)
);

create index on public.owner_statements (tenant_id, owner_id);
create index on public.owner_statements (tenant_id, status);
create index on public.owner_statements (tenant_id, period_year, period_month);

create trigger owner_statements_touch_updated_at
  before update on public.owner_statements
  for each row execute function public.set_updated_at();

-- ─── owner_transactions ────────────────────────────────────
create table public.owner_transactions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  owner_id      uuid not null references public.owner_landlords(id) on delete cascade,
  property_id   uuid references public.properties(id) on delete set null,
  contract_id   uuid references public.property_contracts(id) on delete set null,
  statement_id  uuid references public.owner_statements(id) on delete set null,
  txn_date      date not null,
  type          text not null check (type in
    ('rent_received', 'management_fee', 'works_order', 'other_deduction',
     'payment_to_owner', 'opening_balance', 'adjustment')),
  -- Direction from the OWNER's perspective: rent = in; fee/works/other/payment = out.
  direction     text not null check (direction in ('in', 'out')),
  amount_pence  integer not null check (amount_pence >= 0),
  category      text,
  description   text,
  source_kind   text not null default 'manual'
    check (source_kind in ('rent_payment', 'maintenance_cost', 'manual', 'computed')),
  source_id     uuid,
  reconciled    boolean not null default false,
  is_manual     boolean not null default false,
  created_by    uuid references public.user_profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.owner_transactions (tenant_id, owner_id);
create index on public.owner_transactions (tenant_id, statement_id);
create index on public.owner_transactions (tenant_id, property_id);

-- Dedup derived rows so re-running generation cannot duplicate them
-- (rent_payment/maintenance_cost keyed on their source row; the computed
-- fee line keyed on the statement id). Manual rows have source_id null and
-- are exempt.
create unique index owner_transactions_dedup
  on public.owner_transactions (tenant_id, owner_id, type, source_kind, source_id)
  where source_id is not null;

create trigger owner_transactions_touch_updated_at
  before update on public.owner_transactions
  for each row execute function public.set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────
alter table public.owner_statements enable row level security;
alter table public.owner_transactions enable row level security;

create policy "tenant_members_select_owner_statements"
  on public.owner_statements for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_owner_statements"
  on public.owner_statements for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

create policy "tenant_members_select_owner_transactions"
  on public.owner_transactions for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_owner_transactions"
  on public.owner_transactions for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ─── Storage bucket ────────────────────────────────────────
-- Private bucket — statement PDFs uploaded via the admin client in server
-- actions, read via short-lived signed URLs. First path segment is the
-- tenant id, matching certificate_docs / form-uploads layout.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'owner-statements-pdf',
  'owner-statements-pdf',
  false,
  20971520,
  ARRAY['application/pdf']
)
on conflict (id) do nothing;

create policy "owner_statements_pdf_admin_read" on storage.objects
  for select using (
    bucket_id = 'owner-statements-pdf'
    and (storage.foldername(name))[1]::uuid = (select current_tenant_id())
    and is_admin()
  );
