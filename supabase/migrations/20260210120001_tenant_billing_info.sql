-- Tenant-level billing info (subscription, payment method, billing contact)
-- One row per tenant; admins manage it.

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

-- Only tenant members can read; only admins can modify
create policy "tenant_billing_info select"
on tenant_billing_info for select
using (tenant_id = current_tenant_id());

create policy "tenant_billing_info modify"
on tenant_billing_info for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

comment on table tenant_billing_info is 'Per-tenant subscription/billing details (plan, payment status, billing contact).';
