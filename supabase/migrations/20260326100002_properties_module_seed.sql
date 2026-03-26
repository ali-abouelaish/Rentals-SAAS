-- Properties Module: Seed Data
-- Realistic London mock data for development and demonstration.
-- Seeds portfolios, properties, residents, and units for the first tenant.
-- Safe to rerun — uses ON CONFLICT DO NOTHING.

do $$
declare
  v_tenant_id    uuid;
  v_fen_id       uuid := 'a1000000-0000-0000-0000-000000000001';
  v_jms_id       uuid := 'a1000000-0000-0000-0000-000000000002';
  v_ss_id        uuid := 'a1000000-0000-0000-0000-000000000003';
  v_prop1_id     uuid := 'b1000000-0000-0000-0000-000000000001'; -- FENIX HMO Crossharbour
  v_prop2_id     uuid := 'b1000000-0000-0000-0000-000000000002'; -- JMS HMO Paddington
  v_prop3_id     uuid := 'b1000000-0000-0000-0000-000000000003'; -- Smart Share HMO Balham
  v_prop4_id     uuid := 'b1000000-0000-0000-0000-000000000004'; -- FENIX Studio Surrey Quays
  v_prop5_id     uuid := 'b1000000-0000-0000-0000-000000000005'; -- JMS Whole Flat Bethnal Green
  v_res1_id      uuid := 'c1000000-0000-0000-0000-000000000001';
  v_res2_id      uuid := 'c1000000-0000-0000-0000-000000000002';
  v_res3_id      uuid := 'c1000000-0000-0000-0000-000000000003';
  v_res4_id      uuid := 'c1000000-0000-0000-0000-000000000004';
  v_res5_id      uuid := 'c1000000-0000-0000-0000-000000000005';
  v_res6_id      uuid := 'c1000000-0000-0000-0000-000000000006';
  v_res7_id      uuid := 'c1000000-0000-0000-0000-000000000007';
begin
  -- Get the first tenant's ID
  select id into v_tenant_id from public.tenants order by created_at limit 1;
  if v_tenant_id is null then return; end if;

  -- ============================================================
  -- Portfolios
  -- ============================================================
  insert into public.portfolios (id, tenant_id, name, color) values
    (v_fen_id, v_tenant_id, 'FENIX',       '#0d9488'),
    (v_jms_id, v_tenant_id, 'JMS',         '#2563eb'),
    (v_ss_id,  v_tenant_id, 'Smart Share', '#7c3aed')
  on conflict (id) do nothing;

  -- ============================================================
  -- Properties
  -- ============================================================
  insert into public.properties (
    id, tenant_id, portfolio_id, property_type, name,
    address_line_1, address_line_2, postcode, area, nearest_tube_station,
    total_rooms, total_bathrooms, bills, furnished, parking, garden,
    broadband, washing_machine, dishwasher, central_heating,
    preferred_occupation, preferred_gender
  ) values
  -- FENIX — HMO in Crossharbour
  (v_prop1_id, v_tenant_id, v_fen_id, 'hmo',
   '14 Mastmaker Road', '14 Mastmaker Road', 'Canary Wharf', 'E14 9UB',
   'Crossharbour', 'Crossharbour DLR',
   6, 2, 'all_included', true, false, false, true, true, false, true,
   'professional', 'any'),
  -- JMS — HMO in Paddington
  (v_prop2_id, v_tenant_id, v_jms_id, 'hmo',
   '37 Sussex Gardens', '37 Sussex Gardens', 'Hyde Park', 'W2 1UA',
   'Paddington', 'Paddington',
   5, 2, 'top_up_gas_elec', true, false, true, true, true, false, true,
   'any', 'any'),
  -- Smart Share — HMO in Balham
  (v_prop3_id, v_tenant_id, v_ss_id, 'hmo',
   '22 Balham High Road', '22 Balham High Road', null, 'SW12 9BS',
   'Balham', 'Balham',
   4, 1, 'top_up_elec', true, false, true, true, true, true, true,
   'professional', 'any'),
  -- FENIX — Studio in Surrey Quays
  (v_prop4_id, v_tenant_id, v_fen_id, 'studio',
   '8 Rope Street', '8 Rope Street', null, 'SE16 7TX',
   'Surrey Quays', 'Surrey Quays',
   1, 1, 'all_included', true, false, false, true, true, false, true,
   'any', 'any'),
  -- JMS — Whole Flat in Bethnal Green
  (v_prop5_id, v_tenant_id, v_jms_id, 'whole_flat',
   '91 Cambridge Heath Road', '91 Cambridge Heath Road', null, 'E2 9JA',
   'Bethnal Green', 'Bethnal Green',
   3, 1, 'top_up_gas_elec', true, false, false, true, true, false, true,
   'professional', 'any')
  on conflict (id) do nothing;

  -- ============================================================
  -- Property Residents
  -- ============================================================
  insert into public.property_residents (id, tenant_id, full_name, phone, email, nationality, occupation) values
    (v_res1_id, v_tenant_id, 'Marcus Chen',     '+44 7700 900001', 'marcus.chen@email.com',       'Chinese',     'Software Engineer'),
    (v_res2_id, v_tenant_id, 'Priya Sharma',    '+44 7700 900002', 'priya.sharma@email.com',      'British',     'NHS Nurse'),
    (v_res3_id, v_tenant_id, 'James O''Brien',  '+44 7700 900003', 'james.obrien@email.com',      'Irish',       'Finance Analyst'),
    (v_res4_id, v_tenant_id, 'Sofia Martinez',  '+44 7700 900004', 'sofia.martinez@email.com',    'Spanish',     'Marketing Manager'),
    (v_res5_id, v_tenant_id, 'Kwame Asante',    '+44 7700 900005', 'kwame.asante@email.com',      'Ghanaian',    'Civil Engineer'),
    (v_res6_id, v_tenant_id, 'Amelia Turner',   '+44 7700 900006', 'amelia.turner@email.com',     'British',     'Graphic Designer'),
    (v_res7_id, v_tenant_id, 'David Kowalski',  '+44 7700 900007', 'david.kowalski@email.com',    'Polish',      'Chef')
  on conflict (id) do nothing;

  -- ============================================================
  -- Units — Property 1: 14 Mastmaker Road (6-room HMO, FENIX)
  -- ============================================================
  insert into public.units (
    id, tenant_id, property_id, unit_type, room_number, room_type,
    status, notice_given, available_date,
    min_price_pcm, max_price_pcm, deposit, couples_allowed,
    contract_start_date, contract_end_date, collection_date, furnishings, resident_id
  ) values
  ('d1000001-0000-0000-0000-000000000001', v_tenant_id, v_prop1_id, 'room', '1', 'double',
   'occupied', false, null,
   900, 1050, 1050, false,
   '2025-09-01', '2026-08-31', 1, 'furnished', v_res1_id),

  ('d1000001-0000-0000-0000-000000000002', v_tenant_id, v_prop1_id, 'room', '2', 'single',
   'move_out', true, '2026-04-15',
   750, 850, 850, false,
   '2025-06-01', '2026-04-15', 1, 'furnished', v_res2_id),

  ('d1000001-0000-0000-0000-000000000003', v_tenant_id, v_prop1_id, 'room', '3', 'master',
   'renewal', false, null,
   1100, 1250, 1250, true,
   '2025-03-01', '2026-03-01', 1, 'furnished', v_res3_id),

  ('d1000001-0000-0000-0000-000000000004', v_tenant_id, v_prop1_id, 'room', '4', 'double',
   'available', false, '2026-03-26',
   900, 1000, 1000, false,
   null, null, 1, 'furnished', null),

  ('d1000001-0000-0000-0000-000000000005', v_tenant_id, v_prop1_id, 'room', '5', 'ensuite',
   'booked', false, '2026-04-01',
   1150, 1300, 1300, false,
   null, null, 1, 'furnished', null),

  ('d1000001-0000-0000-0000-000000000006', v_tenant_id, v_prop1_id, 'room', '6', 'single',
   'occupied', false, null,
   750, 850, 850, false,
   '2025-10-01', '2026-09-30', 1, 'furnished', v_res4_id)

  on conflict (id) do nothing;

  -- ============================================================
  -- Units — Property 2: 37 Sussex Gardens (5-room HMO, JMS)
  -- ============================================================
  insert into public.units (
    id, tenant_id, property_id, unit_type, room_number, room_type,
    status, notice_given, available_date,
    min_price_pcm, max_price_pcm, deposit, couples_allowed,
    contract_start_date, contract_end_date, collection_date, furnishings, resident_id
  ) values
  ('d2000001-0000-0000-0000-000000000001', v_tenant_id, v_prop2_id, 'room', '1', 'master',
   'occupied', false, null,
   1200, 1400, 1400, true,
   '2025-07-01', '2026-06-30', 5, 'furnished', v_res5_id),

  ('d2000001-0000-0000-0000-000000000002', v_tenant_id, v_prop2_id, 'room', '2', 'double',
   'available', false, '2026-03-20',
   950, 1100, 1100, false,
   null, null, 5, 'furnished', null),

  ('d2000001-0000-0000-0000-000000000003', v_tenant_id, v_prop2_id, 'room', '3', 'double',
   'on_hold', false, '2026-04-10',
   950, 1100, 1100, false,
   null, null, 5, 'furnished', null),

  ('d2000001-0000-0000-0000-000000000004', v_tenant_id, v_prop2_id, 'room', '4', 'single',
   'occupied', false, null,
   800, 900, 900, false,
   '2026-01-01', '2026-12-31', 5, 'furnished', v_res6_id),

  ('d2000001-0000-0000-0000-000000000005', v_tenant_id, v_prop2_id, 'room', '5', 'ensuite',
   'replacement', false, '2026-05-01',
   1200, 1350, 1350, false,
   '2025-05-01', '2026-04-30', 5, 'furnished', null)

  on conflict (id) do nothing;

  -- ============================================================
  -- Units — Property 3: 22 Balham High Road (4-room HMO, Smart Share)
  -- ============================================================
  insert into public.units (
    id, tenant_id, property_id, unit_type, room_number, room_type,
    status, notice_given, available_date,
    min_price_pcm, max_price_pcm, deposit, couples_allowed,
    contract_start_date, contract_end_date, collection_date, furnishings, resident_id
  ) values
  ('d3000001-0000-0000-0000-000000000001', v_tenant_id, v_prop3_id, 'room', '1', 'double',
   'occupied', false, null,
   875, 975, 975, false,
   '2025-11-01', '2026-10-31', 10, 'furnished', v_res7_id),

  ('d3000001-0000-0000-0000-000000000002', v_tenant_id, v_prop3_id, 'room', '2', 'single',
   'available', false, '2026-03-15',
   725, 800, 800, false,
   null, null, 10, 'furnished', null),

  ('d3000001-0000-0000-0000-000000000003', v_tenant_id, v_prop3_id, 'room', '3', 'double',
   'occupied', false, null,
   875, 975, 975, true,
   '2026-02-01', '2027-01-31', 10, 'furnished', null),

  ('d3000001-0000-0000-0000-000000000004', v_tenant_id, v_prop3_id, 'room', '4', 'master',
   'occupied', false, null,
   1050, 1150, 1150, false,
   '2025-08-01', '2026-07-31', 10, 'furnished', null)

  on conflict (id) do nothing;

  -- ============================================================
  -- Units — Property 4: 8 Rope Street (Studio, FENIX)
  -- ============================================================
  insert into public.units (
    id, tenant_id, property_id, unit_type, room_number, room_type,
    status, notice_given, available_date,
    min_price_pcm, max_price_pcm, deposit, couples_allowed,
    contract_start_date, contract_end_date, collection_date, furnishings, resident_id
  ) values
  ('d4000001-0000-0000-0000-000000000001', v_tenant_id, v_prop4_id, 'studio', null, null,
   'available', false, '2026-04-01',
   1350, 1500, 1500, true,
   null, null, 1, 'furnished', null)
  on conflict (id) do nothing;

  -- ============================================================
  -- Units — Property 5: 91 Cambridge Heath Road (Whole Flat, JMS)
  -- ============================================================
  insert into public.units (
    id, tenant_id, property_id, unit_type, room_number, room_type,
    status, notice_given, available_date,
    min_price_pcm, max_price_pcm, deposit, couples_allowed,
    contract_start_date, contract_end_date, collection_date, furnishings, resident_id
  ) values
  ('d5000001-0000-0000-0000-000000000001', v_tenant_id, v_prop5_id, 'whole_flat', null, null,
   'occupied', false, null,
   2200, 2400, 2400, true,
   '2026-01-15', '2027-01-14', 15, 'furnished', null)
  on conflict (id) do nothing;

end $$;
