-- Phase 4: Maintenance Module Schema
-- Adds source tracking to property_costs.
-- Creates: maintenance_jobs, maintenance_costs, maintenance_photos tables.

-- ============================================================
-- Extend property_costs with source tracking
-- ============================================================

alter table public.property_costs
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'maintenance')),
  add column if not exists source_id uuid;
-- source_id stores maintenance_jobs.id when source = 'maintenance'
-- No FK to avoid circular dependency; enforced at application level.

-- ============================================================
-- Enums
-- ============================================================

create type maintenance_job_status as enum (
  'open', 'in_progress', 'pending_parts', 'pending_quote', 'resolved', 'closed'
);

create type maintenance_job_priority as enum (
  'low', 'medium', 'high', 'critical'
);

create type maintenance_job_category as enum (
  'plumbing', 'electrical', 'structural', 'appliance',
  'pest_control', 'cleaning', 'decoration', 'other'
);

-- ============================================================
-- maintenance_jobs
-- One record per reported issue / work order.
-- ============================================================

create table public.maintenance_jobs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  unit_id        uuid references public.units(id) on delete set null,
  title          text not null,
  description    text,
  category       maintenance_job_category not null default 'other',
  priority       maintenance_job_priority not null default 'medium',
  status         maintenance_job_status not null default 'open',
  reported_by    text,
  assigned_to    text,
  scheduled_date date,
  resolved_date  date,
  total_cost     integer not null default 0, -- pence; sum of maintenance_costs.amount
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on public.maintenance_jobs (tenant_id, status);
create index on public.maintenance_jobs (tenant_id, property_id);
create index on public.maintenance_jobs (tenant_id, priority);
create index on public.maintenance_jobs (tenant_id, created_at desc);

-- ============================================================
-- maintenance_costs
-- Each record auto-creates a mirrored property_costs entry.
-- ============================================================

create table public.maintenance_costs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  job_id           uuid not null references public.maintenance_jobs(id) on delete cascade,
  property_cost_id uuid references public.property_costs(id) on delete set null,
  description      text not null,
  amount           integer not null,   -- pence
  date_incurred    date not null default current_date,
  supplier         text,
  invoice_ref      text,
  created_at       timestamptz not null default now()
);

create index on public.maintenance_costs (tenant_id, job_id);

-- ============================================================
-- maintenance_photos
-- Before/after/progress photos linked to a job.
-- ============================================================

create table public.maintenance_photos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  job_id      uuid not null references public.maintenance_jobs(id) on delete cascade,
  url         text not null,
  caption     text,
  uploaded_at timestamptz not null default now()
);

create index on public.maintenance_photos (tenant_id, job_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.maintenance_jobs   enable row level security;
alter table public.maintenance_costs  enable row level security;
alter table public.maintenance_photos enable row level security;

-- maintenance_jobs
create policy "tenant_members_select_maintenance_jobs"
  on public.maintenance_jobs for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_jobs"
  on public.maintenance_jobs for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- maintenance_costs
create policy "tenant_members_select_maintenance_costs"
  on public.maintenance_costs for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_costs"
  on public.maintenance_costs for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- maintenance_photos
create policy "tenant_members_select_maintenance_photos"
  on public.maintenance_photos for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_photos"
  on public.maintenance_photos for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());
