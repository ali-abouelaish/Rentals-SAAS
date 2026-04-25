-- ============================================================
-- Seed: Tenant History on Properties / Units
-- ============================================================
-- Idempotent — safe to re-run. Uses fixed UUIDs and ON CONFLICT
-- guards so existing rows are left alone.
--
-- Scenarios covered (mirror the acceptance criteria):
--   1. Property with no contracts                 → prop_empty
--   2. Unit with one active tenancy               → unit_hmo_1
--   3. Two consecutive tenancies, no gap          → unit_hmo_2
--   4. Tenancy → void → tenancy (gap rendered)    → unit_hmo_3
--   5. Tenancy → tenancy → trailing vacancy       → unit_studio
--
-- Reference date: 2026-04-25 (today). Edit the dates below if you
-- run this much later — they're chosen to keep the trailing void
-- believable and the 12-month occupancy stat meaningful.
--
-- Prerequisite: the demo tenant '11111111-1111-1111-1111-111111111111'
-- exists (created by supabase/seed.sql). This seed inserts that row
-- with ON CONFLICT DO NOTHING so it's safe to run standalone.
-- ============================================================

-- Demo tenant (idempotent). The tenants table requires a non-null `slug`,
-- so include one when inserting; existing rows are left untouched.
insert into public.tenants (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Demo Agency', 'demo')
on conflict (id) do nothing;

-- Portfolio
insert into public.portfolios (id, tenant_id, name, color)
values (
  '22222222-aaaa-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Tenant History Demo',
  '#0ea5e9'
)
on conflict (id) do nothing;

-- ============================================================
-- Properties
-- ============================================================

-- Empty property (acceptance #1: empty state)
insert into public.properties (
  id, tenant_id, portfolio_id, property_type, name,
  address_line_1, area, postcode, total_rooms, total_bathrooms
)
values (
  '22222222-bbbb-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111111',
  '22222222-aaaa-1111-1111-111111111111',
  'studio',
  'Demo · Empty Studio (no contracts)',
  '11 Empty Lane', 'Hackney', 'E8 0AA', 1, 1
)
on conflict (id) do nothing;

-- Single-unit studio with two ended tenancies + trailing vacancy
insert into public.properties (
  id, tenant_id, portfolio_id, property_type, name,
  address_line_1, area, postcode, total_rooms, total_bathrooms
)
values (
  '22222222-bbbb-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111111',
  '22222222-aaaa-1111-1111-111111111111',
  'studio',
  'Demo · Aldgate Studio (history + trailing void)',
  '42 Whitechapel High St', 'Aldgate East', 'E1 7PT', 1, 1
)
on conflict (id) do nothing;

-- 3-unit HMO with mixed scenarios
insert into public.properties (
  id, tenant_id, portfolio_id, property_type, name,
  address_line_1, area, postcode, total_rooms, total_bathrooms
)
values (
  '22222222-bbbb-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111111',
  '22222222-aaaa-1111-1111-111111111111',
  'hmo',
  'Demo · Bow Road HMO (mixed history)',
  '88 Bow Road', 'Bow', 'E3 2AA', 3, 2
)
on conflict (id) do nothing;

-- ============================================================
-- Units
-- ============================================================

-- prop_empty: one studio unit, no history
insert into public.units (id, tenant_id, property_id, unit_type, status)
values (
  '33333333-cccc-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111111',
  '22222222-bbbb-1111-1111-111111111101',
  'studio', 'available'
)
on conflict (id) do nothing;

-- prop_studio: one studio unit, currently vacant (trailing void)
insert into public.units (
  id, tenant_id, property_id, unit_type, status,
  min_price_pcm, max_price_pcm, deposit
)
values (
  '33333333-cccc-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111111',
  '22222222-bbbb-1111-1111-111111111102',
  'studio', 'available',
  1700, 1800, 1800
)
on conflict (id) do nothing;

-- prop_hmo: three rooms
insert into public.units (
  id, tenant_id, property_id, unit_type, room_number, room_type, status,
  min_price_pcm, max_price_pcm, deposit
)
values
  (
    '33333333-cccc-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '22222222-bbbb-1111-1111-111111111103',
    'room', '1', 'double', 'occupied',
    900, 950, 950
  ),
  (
    '33333333-cccc-1111-1111-111111111112',
    '11111111-1111-1111-1111-111111111111',
    '22222222-bbbb-1111-1111-111111111103',
    'room', '2', 'double', 'occupied',
    950, 1000, 1000
  ),
  (
    '33333333-cccc-1111-1111-111111111113',
    '11111111-1111-1111-1111-111111111111',
    '22222222-bbbb-1111-1111-111111111103',
    'room', '3', 'ensuite', 'occupied',
    1100, 1150, 1150
  )
on conflict (id) do nothing;

-- ============================================================
-- pm_tenants
-- ============================================================
insert into public.pm_tenants (id, tenant_id, full_name, email, phone)
values
  ('44444444-dddd-1111-1111-111111111101', '11111111-1111-1111-1111-111111111111', 'Aaliyah Khan',     'aaliyah@example.com',  '+447700900101'),
  ('44444444-dddd-1111-1111-111111111102', '11111111-1111-1111-1111-111111111111', 'Ben Carter',       'ben@example.com',      '+447700900102'),
  ('44444444-dddd-1111-1111-111111111103', '11111111-1111-1111-1111-111111111111', 'Chloé Martin',     'chloe@example.com',    '+447700900103'),
  ('44444444-dddd-1111-1111-111111111104', '11111111-1111-1111-1111-111111111111', 'Daniel O''Connor', 'daniel@example.com',   '+447700900104'),
  ('44444444-dddd-1111-1111-111111111105', '11111111-1111-1111-1111-111111111111', 'Elif Demir',       'elif@example.com',     '+447700900105'),
  ('44444444-dddd-1111-1111-111111111106', '11111111-1111-1111-1111-111111111111', 'Farhan Ali',       'farhan@example.com',   '+447700900106'),
  ('44444444-dddd-1111-1111-111111111107', '11111111-1111-1111-1111-111111111111', 'Grace Owusu',      'grace@example.com',    '+447700900107')
on conflict (id) do nothing;

-- ============================================================
-- Property contracts
-- ============================================================

-- ── unit_studio: tenancy A → tenancy B → trailing void ──────────
-- Tenancy A: 2024-06-01 → actual_end 2025-04-15  (tenant_notice)
-- Tenancy B: 2025-06-01 → actual_end 2026-03-31  (mutual, small arrears)
-- Then no contract → trailing void rendered up to today.
insert into public.property_contracts (
  id, tenant_id, unit_id, pm_tenant_id, start_date,
  rent_pcm, deposit, deposit_scheme,
  status,
  actual_end_date, end_reason, arrears_at_end, would_relet, end_notes
)
values
  (
    '55555555-eeee-1111-1111-111111111101',
    '11111111-1111-1111-1111-111111111111',
    '33333333-cccc-1111-1111-111111111102',
    '44444444-dddd-1111-1111-111111111101',
    '2024-06-01',
    1750, 1750, 'dps',
    'terminated',
    '2025-04-15', 'tenant_notice', 0, true,
    'Moved out for new job. Spotless handover.'
  ),
  (
    '55555555-eeee-1111-1111-111111111102',
    '11111111-1111-1111-1111-111111111111',
    '33333333-cccc-1111-1111-111111111102',
    '44444444-dddd-1111-1111-111111111102',
    '2025-06-01',
    1800, 1800, 'dps',
    'terminated',
    '2026-03-31', 'mutual', 150, true,
    'Mutual end. £150 unpaid utilities deducted from deposit.'
  )
on conflict (id) do nothing;

-- ── unit_hmo_1: single currently-active tenancy (acceptance #2) ──
insert into public.property_contracts (
  id, tenant_id, unit_id, pm_tenant_id, start_date,
  rent_pcm, deposit, deposit_scheme, status, actual_end_date
)
values (
  '55555555-eeee-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '33333333-cccc-1111-1111-111111111111',
  '44444444-dddd-1111-1111-111111111103',
  '2025-09-01',
  925, 925, 'dps', 'active', null
)
on conflict (id) do nothing;

-- ── unit_hmo_2: two consecutive tenancies, no gap (acceptance #3) ──
-- Tenancy A: 2024-01-01 → 2025-05-31 (landlord_notice, arrears 350)
-- Tenancy B: 2025-06-01 → currently active
insert into public.property_contracts (
  id, tenant_id, unit_id, pm_tenant_id, start_date,
  rent_pcm, deposit, deposit_scheme, status,
  actual_end_date, end_reason, arrears_at_end, would_relet, end_notes
)
values
  (
    '55555555-eeee-1111-1111-111111111121',
    '11111111-1111-1111-1111-111111111111',
    '33333333-cccc-1111-1111-111111111112',
    '44444444-dddd-1111-1111-111111111104',
    '2024-01-01',
    975, 975, 'dps',
    'terminated',
    '2025-05-31', 'landlord_notice', 350, false,
    'Repeated late payment. Recovered £600 from deposit.'
  ),
  (
    '55555555-eeee-1111-1111-111111111122',
    '11111111-1111-1111-1111-111111111111',
    '33333333-cccc-1111-1111-111111111112',
    '44444444-dddd-1111-1111-111111111105',
    '2025-06-01',
    1000, 1000, 'dps',
    'active',
    null, null, 0, null, null
  )
on conflict (id) do nothing;

-- ── unit_hmo_3: tenancy → 61-day void → tenancy (acceptance #4) ──
-- Tenancy A: 2024-02-01 → 2024-12-15 (breach, big arrears, would_relet=false)
-- Void: 2024-12-16 → 2025-02-14  (61 days)
-- Tenancy B: 2025-02-15 → currently active
insert into public.property_contracts (
  id, tenant_id, unit_id, pm_tenant_id, start_date,
  rent_pcm, deposit, deposit_scheme, status,
  actual_end_date, end_reason, arrears_at_end, would_relet, end_notes
)
values
  (
    '55555555-eeee-1111-1111-111111111131',
    '11111111-1111-1111-1111-111111111111',
    '33333333-cccc-1111-1111-111111111113',
    '44444444-dddd-1111-1111-111111111106',
    '2024-02-01',
    1100, 1100, 'mydeposits',
    'terminated',
    '2024-12-15', 'breach', 1200, false,
    'Subletting in breach of contract. Eviction completed. Property left in poor condition — required full deep clean and carpet replacement.'
  ),
  (
    '55555555-eeee-1111-1111-111111111132',
    '11111111-1111-1111-1111-111111111111',
    '33333333-cccc-1111-1111-111111111113',
    '44444444-dddd-1111-1111-111111111107',
    '2025-02-15',
    1150, 1150, 'mydeposits',
    'active',
    null, null, 0, null, null
  )
on conflict (id) do nothing;

-- ============================================================
-- Deposit release on terminated tenancies
-- ============================================================
-- Studio tenancy A (tenant_notice, no arrears) → released in full
update public.property_contracts
   set deposit_returned       = 1750,
       deposit_returned_at    = '2025-04-22',
       deposit_release_notes  = 'Released in full — spotless handover.'
 where id = '55555555-eeee-1111-1111-111111111101';

-- Studio tenancy B (mutual, £150 arrears) → £150 deducted, rest released
update public.property_contracts
   set deposit_returned       = 1650,
       deposit_returned_at    = '2026-04-08',
       deposit_release_notes  = '£150 deducted for unpaid utilities.'
 where id = '55555555-eeee-1111-1111-111111111102';

-- HMO room 2 tenancy A (landlord_notice, £350 arrears) → partial release
update public.property_contracts
   set deposit_returned       = 375,
       deposit_returned_at    = '2025-06-12',
       deposit_release_notes  = '£350 unpaid rent + £250 cleaning deducted.'
 where id = '55555555-eeee-1111-1111-111111111121';

-- HMO room 3 tenancy A (breach, £1,200 arrears) → fully retained
update public.property_contracts
   set deposit_returned       = 0,
       deposit_returned_at    = '2025-01-20',
       deposit_release_notes  = 'Deposit fully retained against arrears and damage.'
 where id = '55555555-eeee-1111-1111-111111111131';

-- ============================================================
-- Rent payments
-- ============================================================
-- One row per (contract, period_year, period_month) thanks to the
-- existing unique index. The amount, paid_at, and notes are deterministic
-- from the contract + period so the upsert is idempotent.
--
-- Generates rent rows from contract.start_date through min(actual_end_date, today).
-- The studio's tenancy A is intentionally short by one month (skipped Aug 2024)
-- so the "balance" indicator on the expanded card shows a "£X short" treatment.

with months as (
  select c.id              as contract_id,
         c.tenant_id,
         c.unit_id,
         c.rent_pcm,
         c.start_date,
         coalesce(c.actual_end_date, current_date) as end_date,
         gs::date           as period_start
    from public.property_contracts c
    cross join lateral generate_series(
      date_trunc('month', c.start_date),
      date_trunc('month', coalesce(c.actual_end_date, current_date)),
      interval '1 month'
    ) gs
   where c.id in (
     '55555555-eeee-1111-1111-111111111101',
     '55555555-eeee-1111-1111-111111111102',
     '55555555-eeee-1111-1111-111111111111',
     '55555555-eeee-1111-1111-111111111121',
     '55555555-eeee-1111-1111-111111111122',
     '55555555-eeee-1111-1111-111111111131',
     '55555555-eeee-1111-1111-111111111132'
   )
)
insert into public.rent_payments (
  tenant_id, contract_id, unit_id,
  period_year, period_month, amount, paid_at, notes
)
select
  tenant_id,
  contract_id,
  unit_id,
  extract(year  from period_start)::int as period_year,
  extract(month from period_start)::int as period_month,
  rent_pcm                              as amount,
  -- Paid on the 3rd of each month, late afternoon
  (period_start + interval '2 days 17 hours')::timestamptz as paid_at,
  null::text as notes
  from months
  -- Skip Aug 2024 on tenancy A of the studio so the card shows arrears.
  where not (
    contract_id = '55555555-eeee-1111-1111-111111111101'
    and extract(year  from period_start)::int = 2024
    and extract(month from period_start)::int = 8
  )
on conflict (contract_id, period_year, period_month) do nothing;

-- ============================================================
-- Sync unit.pm_tenant_id with the currently-active contract so the
-- Properties / Units list shows the right "current tenant" chip.
-- ============================================================

update public.units u
   set pm_tenant_id = c.pm_tenant_id,
       status       = 'occupied',
       updated_at   = now()
  from public.property_contracts c
 where c.unit_id = u.id
   and c.status  = 'active'
   and c.actual_end_date is null;

-- The studio's last contract is terminated → make sure it shows as available.
update public.units
   set pm_tenant_id = null,
       status       = 'available',
       updated_at   = now()
 where id = '33333333-cccc-1111-1111-111111111102';

-- ============================================================
-- Quick sanity check (uncomment to inspect after running):
-- ============================================================
-- select p.name, u.room_number, u.unit_type, count(c.*) as contracts,
--        sum(case when c.actual_end_date is null and c.status='active' then 1 else 0 end) as active
--   from public.properties p
--   join public.units u on u.property_id = p.id
--   left join public.property_contracts c on c.unit_id = u.id
--  where p.id in (
--    '22222222-bbbb-1111-1111-111111111101',
--    '22222222-bbbb-1111-1111-111111111102',
--    '22222222-bbbb-1111-1111-111111111103'
--  )
-- group by p.name, u.room_number, u.unit_type
-- order by p.name, u.room_number nulls first;
