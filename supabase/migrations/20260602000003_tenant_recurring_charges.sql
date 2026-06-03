-- ============================================================
-- Tenant Recurring Charges — recurring contract-tied charges
-- ============================================================
-- Charges billed to tenants in addition to rent: utilities,
-- service charges, parking, cleaning, etc. Always tied to a
-- specific property_contracts row.
-- ============================================================

create type tenant_charge_type as enum (
  'utilities',
  'service_charge',
  'parking',
  'cleaning',
  'other'
);

create table if not exists public.tenant_recurring_charges (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  contract_id     uuid not null references public.property_contracts(id) on delete cascade,
  charge_type     tenant_charge_type not null,
  label           text not null,
  amount          integer not null,                -- pence per recurrence
  recurrence_day  integer not null check (recurrence_day between 1 and 31),
  start_date      date not null,
  end_date        date,
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists tenant_recurring_charges_contract_idx
  on public.tenant_recurring_charges (tenant_id, contract_id);
create index if not exists tenant_recurring_charges_active_idx
  on public.tenant_recurring_charges (tenant_id, is_active);

-- ─── RLS ───────────────────────────────────────────────────
alter table public.tenant_recurring_charges enable row level security;

drop policy if exists "tenant_recurring_charges select" on public.tenant_recurring_charges;
create policy "tenant_recurring_charges select" on public.tenant_recurring_charges
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "tenant_recurring_charges insert" on public.tenant_recurring_charges;
create policy "tenant_recurring_charges insert" on public.tenant_recurring_charges
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "tenant_recurring_charges update" on public.tenant_recurring_charges;
create policy "tenant_recurring_charges update" on public.tenant_recurring_charges
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "tenant_recurring_charges delete" on public.tenant_recurring_charges;
create policy "tenant_recurring_charges delete" on public.tenant_recurring_charges
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));
