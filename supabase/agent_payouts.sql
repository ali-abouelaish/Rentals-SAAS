-- Reference SQL (migrated). Source of truth lives in supabase/migrations.
create table if not exists agent_payouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references user_profiles(id),
  payout_date date not null default current_date,
  amount_gbp numeric(12,2) not null check (amount_gbp >= 0),
  notes text,
  created_by_user_id uuid not null references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_payouts_agent_date
  on agent_payouts(tenant_id, agent_id, payout_date);

create index if not exists idx_agent_payouts_tenant_date
  on agent_payouts(tenant_id, payout_date);

alter table agent_payouts enable row level security;

drop policy if exists "agent payouts select" on agent_payouts;
drop policy if exists "agent payouts modify" on agent_payouts;

create policy "agent payouts select"
on agent_payouts for select
using (
  tenant_id = current_tenant_id()
  and (is_admin() or agent_id = auth.uid())
);

create policy "agent payouts modify"
on agent_payouts for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());
