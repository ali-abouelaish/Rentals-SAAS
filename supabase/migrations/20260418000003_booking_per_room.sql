-- Per-room booking form support:
-- 1. holding_deposit on units (distinct from tenancy deposit)
-- 2. tenant_bank_details — one row per tenant, shown on public booking forms

alter table public.units
  add column if not exists holding_deposit integer;

comment on column public.units.holding_deposit is
  'Flat £ holding deposit shown on the public booking form for this room. Distinct from units.deposit (tenancy deposit).';

create table if not exists public.tenant_bank_details (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  account_holder_name text,
  account_number text,
  sort_code text,
  bank_name text,
  payment_reference_hint text,
  updated_at timestamptz not null default now()
);

alter table public.tenant_bank_details enable row level security;

create policy "tenant_bank_details select"
on public.tenant_bank_details for select
using (tenant_id = current_tenant_id());

create policy "tenant_bank_details modify"
on public.tenant_bank_details for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

comment on table public.tenant_bank_details is
  'Per-tenant bank account details shown on public /apply pages so applicants know where to pay the holding deposit.';
