-- AP Real Estate portfolio import (tenant b5b00020-9b30-4288-8ab4-a1e6c900dc96)
-- Source: AP Real Estate.pdf (provided 2026-04-30)
-- Identical data to 20260430000001_ap_portfolio_import.sql but scoped to a
-- different tenant. UUIDs use a 'bb' prefix instead of 'aa' so both seeds
-- can coexist in the same database without primary-key collisions.
-- Idempotent: uses fixed UUIDs + on conflict (id) do nothing.
--
-- Data interpretations baked in:
--   • "1.5 bathrooms" stored as total_bathrooms=2 + separate_wc=true.
--   • Status column ("Contract Renewal") mapping. Contract end dates are
--     stored on units.available_date (the date the unit next becomes available)
--     since units.contract_start_date / contract_end_date were dropped in
--     phase 2 — tenancy dates now live on property_contracts, which requires
--     pm_tenant_id and so can't be populated from this rent-roll alone.
--       NOW          -> available, no available_date
--       NOW-BOOKED   -> booked,    no available_date (current lease ending, replacement booked)
--       date + ✔     -> renewal,   available_date = the date
--       bare date    -> occupied,  available_date = the date
--       BOOKED       -> booked,    no available_date
--       date-BOOKED  -> booked,    available_date = the date
--       TBC          -> occupied,  no available_date
--   • Source PDF lists two rooms labelled "A" for Broxbourne House (likely
--     typo for "C"). Imported as A and A2 to preserve both rent figures.
--   • Ann Moss Way room B postcode in the source ("£1.00") is a typo;
--     SE16 2TL used to match the building.

do $$
declare
  v_tenant         uuid := 'b5b00020-9b30-4288-8ab4-a1e6c900dc96';
  v_portfolio      uuid := 'bb000000-0000-4000-8000-000000000001';
  v_p_barnando    uuid := 'bb100000-0000-4000-8000-000000000001';
  v_p_netherby    uuid := 'bb100000-0000-4000-8000-000000000002';
  v_p_broxbourne  uuid := 'bb100000-0000-4000-8000-000000000003';
  v_p_evelyn      uuid := 'bb100000-0000-4000-8000-000000000004';
  v_p_ramsey      uuid := 'bb100000-0000-4000-8000-000000000005';
  v_p_annmoss     uuid := 'bb100000-0000-4000-8000-000000000006';
  v_p_johnsilikin uuid := 'bb100000-0000-4000-8000-000000000007';
  v_p_chicksand   uuid := 'bb100000-0000-4000-8000-000000000008';
begin
  -- Skip silently if the tenant doesn't exist in this environment.
  if not exists (select 1 from public.tenants where id = v_tenant) then
    return;
  end if;

  -- ─── Portfolio ─────────────────────────────────────────────
  insert into public.portfolios (id, tenant_id, name, color)
  values (v_portfolio, v_tenant, 'AP', '#0d9488')
  on conflict (id) do nothing;

  -- ─── Bank details ──────────────────────────────────────────
  insert into public.portfolio_bank_details (
    id, tenant_id, portfolio_id, label,
    account_holder_name, account_number, sort_code, bank_name,
    payment_reference_hint, is_default
  ) values
  ('bb200000-0000-4000-8000-000000000001', v_tenant, v_portfolio,
   'Lloyds Business Banking',
   'AP Real Estate', '58434760', '30-54-66', 'Lloyds Business Banking',
   'Property Name & Person Name', true),
  ('bb200000-0000-4000-8000-000000000002', v_tenant, v_portfolio,
   'Monzo (AP Real Estate Solutions Ltd)',
   'AP Real Estate Solutions Ltd', '01897989', '04-00-03', 'Monzo',
   'Property Name & Person Name', false)
  on conflict (id) do nothing;

  -- ─── Properties ────────────────────────────────────────────
  insert into public.properties (
    id, tenant_id, portfolio_id, property_type, name,
    address_line_1, postcode, area, total_rooms, total_bathrooms,
    furnished, broadband, washing_machine, central_heating
  ) values
  (v_p_barnando,    v_tenant, v_portfolio, 'hmo',    'Barnando Gardens',
   'Barnando Gardens',    'E1 0LN',  'Wapping',       5, 2, true, true, true, true),
  (v_p_netherby,    v_tenant, v_portfolio, 'hmo',    '23 Netherby House',
   '23 Netherby House',   'SW8 2SA', 'Lambeth',       5, 2, true, true, true, true),
  (v_p_broxbourne,  v_tenant, v_portfolio, 'hmo',    '17 Broxbourne House',
   '17 Broxbourne House', 'E3 3LJ',  'Bow',           4, 2, true, true, true, true),
  (v_p_evelyn,      v_tenant, v_portfolio, 'hmo',    '60b Evelyn Street',
   '60b Evelyn Street',   'SE8 5DD', 'Surrey Quays',  3, 1, true, true, true, true),
  (v_p_ramsey,      v_tenant, v_portfolio, 'hmo',    '2 Ramsey Street',
   '2 Ramsey Street',     'E2 6HU',  'Shoreditch',    4, 2, true, true, true, true),
  (v_p_annmoss,     v_tenant, v_portfolio, 'hmo',    '48 Ann Moss Way',
   '48 Ann Moss Way',     'SE16 2TL','Canada Water',  4, 2, true, true, true, true),
  (v_p_johnsilikin, v_tenant, v_portfolio, 'studio', '25 John Silikin Lane',
   '25 John Silikin Lane','SE8 5BE', 'Surrey Quays',  2, 1, true, true, true, true),
  (v_p_chicksand,   v_tenant, v_portfolio, 'hmo',    '59 Chicksand House',
   '59 Chicksand House',  'E1 5LH',  'Whitechapel',   3, 2, true, true, true, true)
  on conflict (id) do nothing;

  -- 1.5-bath properties: bathrooms=2 + separate WC.
  update public.properties
     set separate_wc = true
   where id in (v_p_netherby, v_p_broxbourne, v_p_ramsey, v_p_annmoss, v_p_chicksand);

  -- ─── Units ─────────────────────────────────────────────────
  insert into public.units (
    id, tenant_id, property_id, unit_type, room_number,
    status, notice_given, available_date,
    min_price_pcm, max_price_pcm, deposit, couples_allowed,
    furnishings
  ) values
  -- Barnando Gardens (5 rooms, all listed as "NOW")
  ('bb300001-0000-4000-8000-000000000001', v_tenant, v_p_barnando, 'room', 'A',  'available', false, null,          965,  965,  965, false, 'furnished'),
  ('bb300001-0000-4000-8000-000000000002', v_tenant, v_p_barnando, 'room', 'B',  'available', false, null,         1150, 1150, 1150, false, 'furnished'),
  ('bb300001-0000-4000-8000-000000000003', v_tenant, v_p_barnando, 'room', 'C',  'available', false, null,         1050, 1050, 1050, false, 'furnished'),
  ('bb300001-0000-4000-8000-000000000004', v_tenant, v_p_barnando, 'room', 'D',  'booked',    false, null,          975,  975,  975, false, 'furnished'),
  ('bb300001-0000-4000-8000-000000000005', v_tenant, v_p_barnando, 'room', 'E',  'available', false, null,          985,  985,  985, false, 'furnished'),

  -- 23 Netherby House (5 rooms)
  ('bb300002-0000-4000-8000-000000000001', v_tenant, v_p_netherby, 'room', 'D',  'renewal',  false, '2026-05-10',   990,  990,  990, false, 'furnished'),
  ('bb300002-0000-4000-8000-000000000002', v_tenant, v_p_netherby, 'room', 'C',  'occupied', false, '2026-09-24',   965,  965,  965, false, 'furnished'),
  ('bb300002-0000-4000-8000-000000000003', v_tenant, v_p_netherby, 'room', 'E',  'occupied', false, '2026-10-15',   975,  975,  975, false, 'furnished'),
  ('bb300002-0000-4000-8000-000000000004', v_tenant, v_p_netherby, 'room', 'B',  'occupied', false, '2026-10-29',   990,  990,  990, false, 'furnished'),
  ('bb300002-0000-4000-8000-000000000005', v_tenant, v_p_netherby, 'room', 'M1', 'booked',   false, '2026-04-28',  1150, 1150, 1150, false, 'furnished'),

  -- 17 Broxbourne House (4 rooms; second "A" preserved as A2 — see header note)
  ('bb300003-0000-4000-8000-000000000001', v_tenant, v_p_broxbourne, 'room', 'A',  'renewal',  false, '2026-05-30', 1025, 1025, 1025, false, 'furnished'),
  ('bb300003-0000-4000-8000-000000000002', v_tenant, v_p_broxbourne, 'room', 'D',  'occupied', false, '2026-09-06', 1150, 1150, 1150, false, 'furnished'),
  ('bb300003-0000-4000-8000-000000000003', v_tenant, v_p_broxbourne, 'room', 'A2', 'occupied', false, '2026-09-17',  920,  920,  920, false, 'furnished'),
  ('bb300003-0000-4000-8000-000000000004', v_tenant, v_p_broxbourne, 'room', 'B',  'occupied', false, null,          940,  940,  940, false, 'furnished'),

  -- 60b Evelyn Street (3 rooms)
  ('bb300004-0000-4000-8000-000000000001', v_tenant, v_p_evelyn, 'room', 'D1', 'occupied', false, '2026-05-31', 1070, 1070, 1070, false, 'furnished'),
  ('bb300004-0000-4000-8000-000000000002', v_tenant, v_p_evelyn, 'room', 'D2', 'occupied', false, '2026-06-30',  950,  950,  950, false, 'furnished'),
  ('bb300004-0000-4000-8000-000000000003', v_tenant, v_p_evelyn, 'room', 'D3', 'occupied', false, '2026-09-15', 1050, 1050, 1050, false, 'furnished'),

  -- 2 Ramsey Street (4 rooms)
  ('bb300005-0000-4000-8000-000000000001', v_tenant, v_p_ramsey, 'room', 'B', 'occupied', false, '2026-06-30',  890,  890,  890, false, 'furnished'),
  ('bb300005-0000-4000-8000-000000000002', v_tenant, v_p_ramsey, 'room', 'A', 'occupied', false, '2027-01-15', 1100, 1100, 1100, false, 'furnished'),
  ('bb300005-0000-4000-8000-000000000003', v_tenant, v_p_ramsey, 'room', 'D', 'occupied', false, '2027-01-15', 1000, 1000, 1000, false, 'furnished'),
  ('bb300005-0000-4000-8000-000000000004', v_tenant, v_p_ramsey, 'room', 'C', 'occupied', false, '2027-01-15',  955,  955,  955, false, 'furnished'),

  -- 48 Ann Moss Way (4 rooms)
  ('bb300006-0000-4000-8000-000000000001', v_tenant, v_p_annmoss, 'room', 'C', 'occupied', false, '2026-08-31',  950,  950,  950, false, 'furnished'),
  ('bb300006-0000-4000-8000-000000000002', v_tenant, v_p_annmoss, 'room', 'A', 'occupied', false, '2026-09-01', 1125, 1125, 1125, false, 'furnished'),
  ('bb300006-0000-4000-8000-000000000003', v_tenant, v_p_annmoss, 'room', 'B', 'occupied', false, '2026-09-04',  980,  980,  980, false, 'furnished'),
  ('bb300006-0000-4000-8000-000000000004', v_tenant, v_p_annmoss, 'room', 'D', 'occupied', false, '2026-09-08',  980,  980,  980, false, 'furnished'),

  -- 25 John Silikin Lane (1 studio)
  ('bb300007-0000-4000-8000-000000000001', v_tenant, v_p_johnsilikin, 'studio', null, 'occupied', false, '2026-09-30', 1575, 1575, 1575, false, 'furnished'),

  -- 59 Chicksand House (3 rooms, all booked)
  ('bb300008-0000-4000-8000-000000000001', v_tenant, v_p_chicksand, 'room', 'D3', 'booked', false, null,  975,  975,  975, false, 'furnished'),
  ('bb300008-0000-4000-8000-000000000002', v_tenant, v_p_chicksand, 'room', 'D1', 'booked', false, null, 1050, 1050, 1050, false, 'furnished'),
  ('bb300008-0000-4000-8000-000000000003', v_tenant, v_p_chicksand, 'room', 'D2', 'booked', false, null,  950,  950,  950, false, 'furnished')
  on conflict (id) do nothing;

  -- ─── Keybox codes (page 9) — stored as property-level keys ─
  insert into public.keys (id, tenant_id, property_id, set_name, copy_label, status, notes) values
  ('bb400000-0000-4000-8000-000000000001', v_tenant, v_p_netherby,   'Keybox', 'Code', 'in_office', '2323'),
  ('bb400000-0000-4000-8000-000000000002', v_tenant, v_p_ramsey,     'Keybox', 'Code', 'in_office', '202'),
  ('bb400000-0000-4000-8000-000000000003', v_tenant, v_p_chicksand,  'Keybox', 'Code', 'in_office', '5959'),
  ('bb400000-0000-4000-8000-000000000004', v_tenant, v_p_evelyn,     'Keybox', 'Code', 'in_office', '6060'),
  ('bb400000-0000-4000-8000-000000000005', v_tenant, v_p_annmoss,    'Keybox', 'Code', 'in_office', '1997')
  on conflict (id) do nothing;
end $$;
