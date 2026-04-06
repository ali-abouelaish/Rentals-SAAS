-- Phase 3: Profitability Module Schema
-- Tables: property_targets, property_costs, profitability_alerts
-- Run this migration after Phase 2 migrations.

-- ============================================================
-- Enums
-- ============================================================

create type property_cost_type as enum (
  'council_tax',
  'bills',
  'cleaning',
  'maintenance',
  'insurance',
  'owner_rent',
  'agency_fee',
  'furniture',
  'other'
);

create type cost_mode_type as enum (
  'recurring',
  'one_off',
  'amortised'
);

create type profitability_alert_type as enum (
  'profitability_below_target',
  'vacancy_running',
  'vacancy_upcoming',
  'cost_spike',
  'deposit_deadline',
  'landlord_contract_expiry',
  'notice_vacate_approaching'
);

-- ============================================================
-- property_targets
-- Admin sets a minimum monthly profit target per property.
-- ============================================================

create table public.property_targets (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  target_profit_pcm integer not null, -- target monthly net profit in £ (not pence)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, property_id)
);

create index on public.property_targets (tenant_id, property_id);

-- ============================================================
-- property_costs
-- All costs associated with a property or specific unit.
-- ============================================================

create table public.property_costs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  property_id         uuid not null references public.properties(id) on delete cascade,
  unit_id             uuid references public.units(id) on delete set null,
  cost_type           property_cost_type not null,
  cost_label          text,               -- custom label; required for "other"
  amount              integer not null,   -- in pence
  cost_mode           cost_mode_type not null default 'recurring',
  recurrence_day      integer check (recurrence_day between 1 and 31), -- day of month for recurring
  amortise_months     integer,            -- for amortised furniture costs
  amortise_start_date date,               -- start of amortisation period
  purchase_date       date,               -- for furniture / one-off
  date_incurred       date not null default current_date,
  notes               text,
  created_at          timestamptz not null default now()
);

create index on public.property_costs (tenant_id, property_id);
create index on public.property_costs (tenant_id, date_incurred);
create index on public.property_costs (tenant_id, cost_mode);

-- ============================================================
-- profitability_alerts
-- Persisted alert records until the underlying issue is resolved.
-- ============================================================

create table public.profitability_alerts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  unit_id      uuid references public.units(id) on delete set null,
  alert_type   profitability_alert_type not null,
  triggered_at timestamptz not null default now(),
  resolved_at  timestamptz,
  is_resolved  boolean not null default false,
  metadata     jsonb not null default '{}',
  email_sent   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index on public.profitability_alerts (tenant_id, is_resolved);
create index on public.profitability_alerts (tenant_id, property_id);
create index on public.profitability_alerts (tenant_id, alert_type);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.property_targets enable row level security;
alter table public.property_costs enable row level security;
alter table public.profitability_alerts enable row level security;

-- property_targets policies
create policy "tenant_members_select_property_targets"
  on public.property_targets for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_property_targets"
  on public.property_targets for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- property_costs policies
create policy "tenant_members_select_property_costs"
  on public.property_costs for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_property_costs"
  on public.property_costs for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- profitability_alerts policies
create policy "tenant_members_select_profitability_alerts"
  on public.profitability_alerts for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_profitability_alerts"
  on public.profitability_alerts for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());
