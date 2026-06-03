-- ============================================================
-- Monthly Closes — period locking + reconciliation snapshot
-- ============================================================
-- A monthly_closes row tracks the status of an accounting month
-- for a tenant. When status = 'closed', mutating actions on the
-- underlying tables (rent_payments, property_costs, business_
-- overheads, tenant_recurring_charges, finance_entries) refuse
-- writes for that (year, month).
--
-- The snapshot column holds the computed P&L totals captured at
-- close time so the Finances hub keeps showing stable numbers
-- even if a source row is later edited/unlocked.
-- ============================================================

create type monthly_close_status as enum ('open', 'in_review', 'closed');

create table if not exists public.monthly_closes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  year            integer not null,
  month           integer not null check (month between 1 and 12),
  status          monthly_close_status not null default 'open',
  checklist       jsonb not null default '{}'::jsonb,
  snapshot        jsonb,
  notes           text,
  closed_at       timestamptz,
  closed_by       uuid references public.user_profiles(id) on delete set null,
  reopened_at     timestamptz,
  reopened_by     uuid references public.user_profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, year, month)
);

create index if not exists monthly_closes_tenant_status_idx
  on public.monthly_closes (tenant_id, status);

-- ─── Add finance_entries.close_id FK now that monthly_closes exists ───
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'finance_entries_close_id_fkey'
      and table_schema = 'public'
  ) then
    alter table public.finance_entries
      add constraint finance_entries_close_id_fkey
      foreign key (close_id) references public.monthly_closes(id) on delete set null;
  end if;
end$$;

-- ─── RLS ───────────────────────────────────────────────────
alter table public.monthly_closes enable row level security;

drop policy if exists "monthly_closes select" on public.monthly_closes;
create policy "monthly_closes select" on public.monthly_closes
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "monthly_closes insert" on public.monthly_closes;
create policy "monthly_closes insert" on public.monthly_closes
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "monthly_closes update" on public.monthly_closes;
create policy "monthly_closes update" on public.monthly_closes
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "monthly_closes delete" on public.monthly_closes;
create policy "monthly_closes delete" on public.monthly_closes
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));
