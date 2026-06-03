-- ============================================================
-- Business Overheads — tenant-of-app costs not tied to a property
-- ============================================================
-- Examples: software subscriptions, payroll, office rent,
-- accounting fees, insurance, marketing spend, professional fees.
-- Reuses cost_mode_type enum from property_costs schema.
-- ============================================================

create type overhead_category as enum (
  'software',
  'payroll',
  'office_rent',
  'accounting',
  'insurance',
  'marketing',
  'professional_fees',
  'bank_fees',
  'other'
);

create table if not exists public.business_overheads (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  category            overhead_category not null,
  label               text not null,
  amount              integer not null,                -- pence
  vendor              text,
  cost_mode           cost_mode_type not null default 'recurring',
  recurrence_day      integer check (recurrence_day between 1 and 31),
  amortise_months     integer check (amortise_months is null or amortise_months > 0),
  amortise_start_date date,
  date_incurred       date not null default current_date,
  is_active           boolean not null default true,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists business_overheads_tenant_mode_idx
  on public.business_overheads (tenant_id, cost_mode);
create index if not exists business_overheads_tenant_date_idx
  on public.business_overheads (tenant_id, date_incurred);
create index if not exists business_overheads_tenant_active_idx
  on public.business_overheads (tenant_id, is_active);

-- ─── RLS ───────────────────────────────────────────────────
alter table public.business_overheads enable row level security;

drop policy if exists "business_overheads select" on public.business_overheads;
create policy "business_overheads select" on public.business_overheads
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "business_overheads insert" on public.business_overheads;
create policy "business_overheads insert" on public.business_overheads
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "business_overheads update" on public.business_overheads;
create policy "business_overheads update" on public.business_overheads
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "business_overheads delete" on public.business_overheads;
create policy "business_overheads delete" on public.business_overheads
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));
