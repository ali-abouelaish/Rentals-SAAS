-- Run in Supabase Dashboard SQL Editor if migrations are not applied via CLI.
-- Creates tenant_billing_info table and RLS.

create table if not exists tenant_billing_info (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'professional', 'enterprise')),
  billing_email text,
  billing_name text,
  billing_address text,
  payment_status text not null default 'active' check (payment_status in ('active', 'past_due', 'canceled', 'trialing', 'unpaid')),
  next_billing_date date,
  stripe_customer_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create index if not exists idx_tenant_billing_info_tenant on tenant_billing_info(tenant_id);

alter table tenant_billing_info enable row level security;

drop policy if exists "tenant_billing_info select" on tenant_billing_info;
drop policy if exists "tenant_billing_info modify" on tenant_billing_info;

create policy "tenant_billing_info select"
on tenant_billing_info for select
using (tenant_id = current_tenant_id());

create policy "tenant_billing_info modify"
on tenant_billing_info for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());
