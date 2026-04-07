-- Rent payment records per contract per month
create table rent_payments (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  contract_id  uuid        not null references property_contracts(id) on delete cascade,
  unit_id      uuid        not null references units(id) on delete cascade,
  period_year  int         not null,
  period_month int         not null check (period_month between 1 and 12),
  amount       numeric(10,2) not null,
  paid_at      timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now()
);

-- One payment record per contract per calendar month
create unique index rent_payments_contract_period_unique
  on rent_payments (contract_id, period_year, period_month);

alter table rent_payments enable row level security;

create policy "Tenant members can manage rent_payments"
  on rent_payments
  for all
  using (
    tenant_id in (
      select tenant_id from user_profiles where id = (select auth.uid())
    )
  )
  with check (
    tenant_id in (
      select tenant_id from user_profiles where id = (select auth.uid())
    )
  );
