-- ============================================================
-- Finance Entries — unified materialized ledger
-- ============================================================
-- Single immutable-by-default row per posted line for a given
-- (year, month). Materialized from rent_payments, property_costs,
-- business_overheads, tenant_recurring_charges, and synthetic
-- owner_rent + manual adjustments. Drives the Finances hub for
-- closed/posted months; live-compute is the fallback otherwise.
-- ============================================================

create type finance_direction as enum ('income', 'expense');

create type finance_source_kind as enum (
  'rent_payment',
  'property_cost',
  'business_overhead',
  'tenant_charge',
  'owner_rent',
  'bank_credit',
  'manual'
);

create table if not exists public.finance_entries (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  year         integer not null,
  month        integer not null check (month between 1 and 12),
  direction    finance_direction not null,
  amount       integer not null check (amount >= 0),  -- pence, positive; sign comes from direction
  source_kind  finance_source_kind not null,
  source_id    uuid,                                  -- references the source row (rent_payments.id, property_costs.id, etc.)
  property_id  uuid references public.properties(id) on delete set null,
  unit_id      uuid references public.units(id) on delete set null,
  contract_id  uuid references public.property_contracts(id) on delete set null,
  label        text not null,
  category     text,
  notes        text,
  posted_at    timestamptz not null default now(),
  posted_by    uuid references public.user_profiles(id) on delete set null,
  close_id     uuid,                                  -- FK added in monthly_closes migration
  created_at   timestamptz not null default now()
);

create index if not exists finance_entries_tenant_month_idx
  on public.finance_entries (tenant_id, year, month);
create index if not exists finance_entries_tenant_source_kind_idx
  on public.finance_entries (tenant_id, source_kind);
create index if not exists finance_entries_tenant_property_idx
  on public.finance_entries (tenant_id, property_id);

-- Idempotency: a single (tenant_id, year, month, source_kind, source_id)
-- can only be posted once. Manual adjustments (source_id is null) are not
-- deduped — admins can layer multiple corrections.
create unique index if not exists finance_entries_source_unique
  on public.finance_entries (tenant_id, year, month, source_kind, source_id)
  where source_id is not null;

-- ─── Defense-in-depth trigger: refuse writes to a closed month ───
-- monthly_closes does not exist yet (added in the next migration). We
-- create the function defensively so it tolerates the missing table.
create or replace function public.assert_finance_entry_month_open()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  begin
    select status into v_status
      from public.monthly_closes
     where tenant_id = new.tenant_id
       and year = new.year
       and month = new.month;
  exception
    when undefined_table then
      return new;
  end;
  if v_status = 'closed' then
    raise exception 'Month %-% is closed and cannot be modified',
      new.year, lpad(new.month::text, 2, '0')
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists finance_entries_month_open on public.finance_entries;
create trigger finance_entries_month_open
  before insert or update on public.finance_entries
  for each row execute function public.assert_finance_entry_month_open();

-- ─── RLS ───────────────────────────────────────────────────
alter table public.finance_entries enable row level security;

drop policy if exists "finance_entries select" on public.finance_entries;
create policy "finance_entries select" on public.finance_entries
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "finance_entries insert" on public.finance_entries;
create policy "finance_entries insert" on public.finance_entries
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "finance_entries update" on public.finance_entries;
create policy "finance_entries update" on public.finance_entries
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "finance_entries delete" on public.finance_entries;
create policy "finance_entries delete" on public.finance_entries
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));
