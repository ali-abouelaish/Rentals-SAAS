-- Backfill move-in rent_payments rows for existing live contracts.
-- This catches contracts that were created before the auto-record logic
-- shipped (or before prepaid_first_full_month was a separate flag), and
-- inserts the implied pro-rata / first-full-month rows when they don't
-- already exist.
--
-- Safe to re-run: the WHERE NOT EXISTS clause skips any (contract, period)
-- that already has a rent_payments row.

-- 1. Pro-rata payment for the move-in month, when pro_rata_amount > 0.
insert into rent_payments (
  tenant_id, contract_id, unit_id,
  period_year, period_month, amount, paid_at, notes
)
select
  c.tenant_id,
  c.id,
  c.unit_id,
  extract(year  from c.start_date)::int,
  extract(month from c.start_date)::int,
  c.pro_rata_amount,
  (c.start_date::timestamp at time zone 'UTC') + interval '12 hours',
  'Auto-recorded at contract creation (move-in payment)'
from property_contracts c
where c.status in ('active', 'signed', 'notice_given')
  and c.pro_rata_amount is not null
  and c.pro_rata_amount > 0
  and not exists (
    select 1 from rent_payments rp
    where rp.contract_id = c.id
      and rp.period_year  = extract(year  from c.start_date)::int
      and rp.period_month = extract(month from c.start_date)::int
  );

-- 2. First-full-month payment (next calendar month after move-in), when
--    prepaid_first_full_month = true and rent_pcm > 0.
insert into rent_payments (
  tenant_id, contract_id, unit_id,
  period_year, period_month, amount, paid_at, notes
)
select
  c.tenant_id,
  c.id,
  c.unit_id,
  extract(year  from (date_trunc('month', c.start_date) + interval '1 month'))::int,
  extract(month from (date_trunc('month', c.start_date) + interval '1 month'))::int,
  c.rent_pcm,
  (c.start_date::timestamp at time zone 'UTC') + interval '12 hours',
  'Auto-recorded at contract creation (move-in payment)'
from property_contracts c
where c.status in ('active', 'signed', 'notice_given')
  and c.prepaid_first_full_month = true
  and c.rent_pcm > 0
  and not exists (
    select 1 from rent_payments rp
    where rp.contract_id = c.id
      and rp.period_year  = extract(year  from (date_trunc('month', c.start_date) + interval '1 month'))::int
      and rp.period_month = extract(month from (date_trunc('month', c.start_date) + interval '1 month'))::int
  );
