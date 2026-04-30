-- Horizon Dreams Ltd portfolio import
-- Tenant: b5b00020-9b30-4288-8ab4-a1e6c900dc96
-- Source: Horizon Dreams Ltd.pdf (provided 2026-04-30)
-- Imports the Horizon Dreams portfolio + Barclays bank details, 12 properties,
-- 52 units, 50 pm_tenants (each linked to its current unit via units.pm_tenant_id),
-- and 8 keybox codes (1A Court Street code applied to both flat 1 + flat 2).
--
-- Notes:
--   • Tenancy end dates are stored on units.available_date. property_contracts
--     not used here because it requires start_date/rent_pcm/deposit fields the
--     rent-roll doesn't provide.
--   • Source has two records for Trundley Road D1 (Bilal 2026-05-31 ✔, then
--     Ojas Arora 2026-09-18). Both kept in pm_tenants; the unit links to Ojas
--     (the later record). Bilal is preserved as an unlinked pm_tenant.
--   • pm_tenants.full_name / phone / email are NOT NULL. Where the PDF has no
--     value, placeholders 'unknown' and *@horizondreams.local are used.
--   • Couples MAYBE (St Michael's ENSA) -> couples_allowed=false.
--     Couples YES  (Plough Way D2)      -> couples_allowed=true.
--   • DOBs not imported — source mixes DD/MM/YYYY and MM/DD/YYYY without a
--     reliable signal. Set them via the UI.
--   • "31/04/2027" (Michael Briggs) read as 2027-04-30 (April has 30 days).
--   • Idempotent: fixed UUIDs + on conflict (id) do nothing.

do $$
declare
  v_tenant       uuid := 'b5b00020-9b30-4288-8ab4-a1e6c900dc96';
  v_portfolio    uuid := 'cc000000-0000-4000-8000-000000000001';
  -- Properties
  v_p_bush       uuid := 'cc100000-0000-4000-8000-000000000001';
  v_p_chargrove  uuid := 'cc100000-0000-4000-8000-000000000002';
  v_p_court1     uuid := 'cc100000-0000-4000-8000-000000000003';
  v_p_everard    uuid := 'cc100000-0000-4000-8000-000000000004';
  v_p_trundley   uuid := 'cc100000-0000-4000-8000-000000000005';
  v_p_boundaries uuid := 'cc100000-0000-4000-8000-000000000006';
  v_p_parkwest   uuid := 'cc100000-0000-4000-8000-000000000007';
  v_p_court2     uuid := 'cc100000-0000-4000-8000-000000000008';
  v_p_alloa      uuid := 'cc100000-0000-4000-8000-000000000009';
  v_p_ramar      uuid := 'cc100000-0000-4000-8000-00000000000a';
  v_p_plough     uuid := 'cc100000-0000-4000-8000-00000000000b';
  v_p_stmichael  uuid := 'cc100000-0000-4000-8000-00000000000c';
begin
  if not exists (select 1 from public.tenants where id = v_tenant) then
    return;
  end if;

  -- ─── Portfolio ─────────────────────────────────────────────
  insert into public.portfolios (id, tenant_id, name, color)
  values (v_portfolio, v_tenant, 'Horizon Dreams', '#2563eb')
  on conflict (id) do nothing;

  -- ─── Bank details (Barclays) ───────────────────────────────
  insert into public.portfolio_bank_details (
    id, tenant_id, portfolio_id, label,
    account_holder_name, account_number, sort_code, bank_name,
    payment_reference_hint, is_default
  ) values
  ('cc200000-0000-4000-8000-000000000001', v_tenant, v_portfolio,
   'Barclays', 'Horizon Dreams Limited', '03630064', '20-41-50',
   'Barclays', 'Property number of the room', true)
  on conflict (id) do nothing;

  -- ─── Properties ────────────────────────────────────────────
  insert into public.properties (
    id, tenant_id, portfolio_id, property_type, name,
    address_line_1, postcode, area, total_rooms, total_bathrooms,
    furnished, broadband, washing_machine, central_heating
  ) values
  (v_p_bush,       v_tenant, v_portfolio, 'hmo', '9 Bush Road',
   '9 Bush Road',             'SE8 5AP',  'Surrey Quays', 5, 3, true, true, true, true),
  (v_p_chargrove,  v_tenant, v_portfolio, 'hmo', '7 Chargrove Close',
   '7 Chargrove Close',       'SE16 6AP', 'Canada Water', 5, 3, true, true, true, true),
  (v_p_court1,     v_tenant, v_portfolio, 'hmo', '1A Court Street (Flat 1)',
   '1A Court Street, Flat 1', 'E1 1DG',   'Whitechapel',  4, 2, true, true, true, true),
  (v_p_everard,    v_tenant, v_portfolio, 'hmo', '15 Everard House',
   '15 Everard House',        'E1 1LY',   'Aldgate East', 4, 1, true, true, true, true),
  (v_p_trundley,   v_tenant, v_portfolio, 'hmo', '149 Trundley''s Road',
   '149 Trundley''s Road',    'SE8 5JQ',  'Surrey Quays', 5, 2, true, true, true, true),
  (v_p_boundaries, v_tenant, v_portfolio, 'hmo', '129 Boundaries Road',
   '129 Boundaries Road',     'SW12 8EU', 'Balham',       6, 2, true, true, true, true),
  (v_p_parkwest,   v_tenant, v_portfolio, 'hmo', '20 Park West',
   '20 Park West',            'W2 2QG',   'Hyde Park',    3, 1, true, true, true, true),
  (v_p_court2,     v_tenant, v_portfolio, 'hmo', '1A Court Street (Flat 2)',
   '1A Court Street, Flat 2', 'E1 1DG',   'Whitechapel',  4, 2, true, true, true, true),
  (v_p_alloa,      v_tenant, v_portfolio, 'hmo', '25 Alloa Road',
   '25 Alloa Road',           'SE8 5AH',  'Surrey Quays', 5, 2, true, true, true, true),
  (v_p_ramar,      v_tenant, v_portfolio, 'hmo', '9 Ramar House',
   '9 Ramar House',           'E1 5JH',   'Whitechapel',  4, 1, true, true, true, true),
  (v_p_plough,     v_tenant, v_portfolio, 'hmo', '9A Plough Way',
   '9A Plough Way',           'SE16 2LS', 'Canada Water', 3, 1, true, true, true, true),
  (v_p_stmichael,  v_tenant, v_portfolio, 'hmo', '81 St Michael''s Street',
   '81 St Michael''s Street', 'W2 1YN',   'Paddington',   4, 2, true, true, true, true)
  on conflict (id) do nothing;

  -- 1.5-bath properties (Court Street 1, Court Street 2, Alloa Road)
  -- stored as bathrooms=2 + separate WC.
  update public.properties
     set separate_wc = true
   where id in (v_p_court1, v_p_court2, v_p_alloa);

  -- ─── pm_tenants ────────────────────────────────────────────
  insert into public.pm_tenants (
    id, tenant_id, full_name, phone, email, nationality, notes
  ) values
  ('cc500000-0000-4000-8000-000000000001', v_tenant, 'Abi Malster',                          '+44 7512 571350', 'am_19-7-93@hotmail.co.uk',             'British',    null),
  ('cc500000-0000-4000-8000-000000000002', v_tenant, 'Riddhima Duggal',                      '7731811997',      'riddhima96duggal@gmail.com',           'Indian',     null),
  ('cc500000-0000-4000-8000-000000000003', v_tenant, 'Sean Hamill',                          '447554147957',    'sean.hamill01@gmail.com',              'British',    null),
  ('cc500000-0000-4000-8000-000000000004', v_tenant, 'Lanping Zhang',                        'unknown',         'cherry_zhang020@163.com',              'Chinese',    null),
  ('cc500000-0000-4000-8000-000000000005', v_tenant, 'Siddhant Pagare',                      'unknown',         'siddhantpagare2014@gmail.com',         'Indian',     null),
  ('cc500000-0000-4000-8000-000000000006', v_tenant, 'Benjamin Angel',                       'unknown',         'benjaminrobangel@gmail.com',           'Canadian',   null),
  ('cc500000-0000-4000-8000-000000000007', v_tenant, 'Zunaid Rafique',                       '07301267769',     'zunaidrafique@gmail.com',              'Indian',     null),
  ('cc500000-0000-4000-8000-000000000008', v_tenant, 'Bilal',                                'unknown',         'bilal@horizondreams.local',            'Indian',     'Source PDF: "cant find con" — contract not located. Trundley Road D1 record dated 2026-05-31 ✔; superseded by Ojas Arora (2026-09-18).'),
  ('cc500000-0000-4000-8000-000000000009', v_tenant, 'Diya Raja',                            'unknown',         'Diya.s.raja@gmail.com',                'Indian',     null),
  ('cc500000-0000-4000-8000-000000000010', v_tenant, 'Maisie Sheree Boardman',               '7786666921',      'Maisie.b552@gmail.com',                'British',    null),
  ('cc500000-0000-4000-8000-000000000011', v_tenant, 'Louis Gabriel Renelier',               '33698593127',     'lg.renelier@gmail.com',                'French',     null),
  ('cc500000-0000-4000-8000-000000000012', v_tenant, 'Edouard de Pouilly',                   '0689192243',      'depouillyedouard@gmail.com',           'French',     null),
  ('cc500000-0000-4000-8000-000000000014', v_tenant, 'Hamza Ahmed',                          '447901804204',    '92hamzaahmed@gmail.com',               'Pakistani',  null),
  ('cc500000-0000-4000-8000-000000000015', v_tenant, 'Kretika Arora',                        '919650925666',    'kretikaarora@gmail.com',               'Indian',     null),
  ('cc500000-0000-4000-8000-000000000016', v_tenant, 'Batuhan',                              '905415879747',    'batuhanka.9747@gmail.com',             'Turkish',    null),
  ('cc500000-0000-4000-8000-000000000017', v_tenant, 'Gyalden Lama',                         '7586577715',      'gyalden.lama97@gmail.com',             'Indian',     null),
  ('cc500000-0000-4000-8000-000000000018', v_tenant, 'Victoria Mihaylova Draganova',         '7377005779',      'victoria.m.draganova@gmail.com',       'British',    null),
  ('cc500000-0000-4000-8000-000000000019', v_tenant, 'Emma Belhuerne',                       '33781790178',     'emmabelhuerne@gmail.com',              'French',     null),
  ('cc500000-0000-4000-8000-000000000020', v_tenant, 'Latisha Hill',                         '7745192286',      'latishahill1111@gmail.com',            'German',     null),
  ('cc500000-0000-4000-8000-000000000021', v_tenant, 'Havva Salih',                          '7857887870',      'salihhavva2001@gmail.com',             'Bulgarian',  null),
  ('cc500000-0000-4000-8000-000000000022', v_tenant, 'Sofiia Alieksieienko',                 '447780755503',    'sofia.alekseemko16@gmail.con',         'Ukrainian',  'Email kept verbatim from source ("@gmail.con" — likely typo).'),
  ('cc500000-0000-4000-8000-000000000024', v_tenant, 'Stefania Thoma',                       '+44 7928 734731', 'stefaniath002@gmail.com',              'Greek',      null),
  ('cc500000-0000-4000-8000-000000000025', v_tenant, 'Mudit Maheshwari',                     '447818936350',    'muditmaheshwari1408@gmail.com',        'Indian',     null),
  ('cc500000-0000-4000-8000-000000000026', v_tenant, 'Llazar Gogollari',                     '+44 7780 071311', 'gogollaris@gmail.com',                 'Greek',      null),
  ('cc500000-0000-4000-8000-000000000027', v_tenant, 'Songying Liu',                         'unknown',         'guangtasongying@gmail.com',            'Chinese',    null),
  ('cc500000-0000-4000-8000-000000000028', v_tenant, 'Sohini Mallick',                       '+91 8951557284',  'Sohini.mallick.mba23@said.oxford.edu', 'Indian',     null),
  ('cc500000-0000-4000-8000-000000000029', v_tenant, 'David Knox',                           '7350476517',      'knoxdavey7@gmail.com',                 'Zimbabwean', null),
  ('cc500000-0000-4000-8000-000000000030', v_tenant, 'Justine Petit',                        '33680818020',     'justinepetit01@gmail.com',             'French',     null),
  ('cc500000-0000-4000-8000-000000000031', v_tenant, 'Gandharv Sharma',                      '7436901272',      's.gandharv41@gmail.com',               'Indian',     null),
  ('cc500000-0000-4000-8000-000000000032', v_tenant, 'James Charles White',                  '7894756130',      'jamescwhitey36@gmail.com',             'British',    null),
  ('cc500000-0000-4000-8000-000000000033', v_tenant, 'Arib Ahnaf Sahil',                     'unknown',         'fariashreya01@gmail.com',              null,         null),
  ('cc500000-0000-4000-8000-000000000034', v_tenant, 'Kirupa SaiLakshmi Pulichintala Raja',  '+44 7749602363',  'kirupasailakshmi@gmail.com',           'Indian',     null),
  ('cc500000-0000-4000-8000-000000000035', v_tenant, 'Joshua Andrew Sadleir',                '7532674885',      'contact@joshuasadleir.com',            'British',    null),
  ('cc500000-0000-4000-8000-000000000036', v_tenant, 'Sotiria Eleni Zve',                    '7939998917',      'eleni.s.zve@gmail.com',                'Greek',      null),
  ('cc500000-0000-4000-8000-000000000037', v_tenant, 'Jerlin Michelle Immanuel Jebasingh',   '7398683509',      'michellejerlin@gmail.com',             'Indian',     null),
  ('cc500000-0000-4000-8000-000000000038', v_tenant, 'Grace Plummer',                        '7940753121',      'gplummer@ohs.uk',                      'British',    null),
  ('cc500000-0000-4000-8000-000000000039', v_tenant, 'Ojas Arora',                           '7360548392',      'ojas4jan@gmail.com',                   'Indian',     null),
  ('cc500000-0000-4000-8000-000000000040', v_tenant, 'Mohamed Shafeek SMK',                  '7572921520',      'shafeek.er1996@gmail.com',             'Indian',     null),
  ('cc500000-0000-4000-8000-000000000041', v_tenant, 'Georgios Pekaridis',                   '7490562506',      'George_pekar@hotmail.com',             'Greek',      null),
  ('cc500000-0000-4000-8000-000000000043', v_tenant, 'Mohammed Tanvir Hussain',              'unknown',         'tanvirhussain.lps@gmail.com',          null,         null),
  ('cc500000-0000-4000-8000-000000000044', v_tenant, 'Yumna Mansoer',                        '447983864421',    'mansoer.yumna1@gmail.com',             'Indonesian', null),
  ('cc500000-0000-4000-8000-000000000045', v_tenant, 'Luz del Alba Gradin Armas',            '7923011004',      'a.yamilyamiley19@gmail.com',           null,         null),
  ('cc500000-0000-4000-8000-000000000046', v_tenant, 'Aiswarya Annie Santhosh',              '+44 7561 489798', 'Aiswarya.santhosh19@gmail.com',        'Indian',     'Source listed second number: +91 9633999507.'),
  ('cc500000-0000-4000-8000-000000000047', v_tenant, 'James Le Grice',                       '7728780459',      'jameslegrice03@gmail.com',             null,         null),
  ('cc500000-0000-4000-8000-000000000048', v_tenant, 'Leah Pidgeon',                         '353876618600',    'leahpidgeon@gmail.com',                null,         null),
  ('cc500000-0000-4000-8000-000000000049', v_tenant, 'Adrian Frydman',                       '447562291413',    'Adrianfrydman@me.com',                 'Mexican',    'Source listed second number: +52 5585347092. Couples=YES.'),
  ('cc500000-0000-4000-8000-000000000050', v_tenant, 'Marie Croppi',                         '33777720292',     'marie.croppi@gmail.com',               'French',     null),
  ('cc500000-0000-4000-8000-000000000051', v_tenant, 'Jiewu Deng',                           '7900997132',      'jiewu2004@outlook.com',                'Chinese',    null),
  ('cc500000-0000-4000-8000-000000000052', v_tenant, 'Michael Briggs',                       '7956992669',      'mathew.antony.briggs@gmail.com',       'British',    null),
  ('cc500000-0000-4000-8000-000000000053', v_tenant, 'Saksham Dhingra',                      '+44 7546 903932', 'saksham.off@gmail.com',                'Indian',     null)
  on conflict (id) do nothing;

  -- ─── Units ─────────────────────────────────────────────────
  insert into public.units (
    id, tenant_id, property_id, unit_type, room_number,
    status, notice_given, available_date,
    min_price_pcm, max_price_pcm, deposit, couples_allowed,
    furnishings, pm_tenant_id
  ) values
  -- 9 Bush Road (5 rooms)
  ('cc300000-0000-4000-8000-000000000001', v_tenant, v_p_bush, 'room', 'D1',   'occupied', false, null,          975,  975,  975, false, 'furnished', 'cc500000-0000-4000-8000-000000000001'),
  ('cc300000-0000-4000-8000-000000000002', v_tenant, v_p_bush, 'room', 'ENS5', 'renewal',  false, null,         1200, 1200, 1200, false, 'furnished', 'cc500000-0000-4000-8000-000000000002'),
  ('cc300000-0000-4000-8000-000000000003', v_tenant, v_p_bush, 'room', 'ENS3', 'occupied', false, '2026-06-30', 1150, 1175, 1175, false, 'furnished', 'cc500000-0000-4000-8000-000000000015'),
  ('cc300000-0000-4000-8000-000000000004', v_tenant, v_p_bush, 'room', 'D2',   'occupied', false, null,          950,  950,  950, false, 'furnished', 'cc500000-0000-4000-8000-000000000053'),
  ('cc300000-0000-4000-8000-000000000005', v_tenant, v_p_bush, 'room', 'D4',   'occupied', false, '2026-08-28',  950,  950,  950, false, 'furnished', 'cc500000-0000-4000-8000-000000000025'),

  -- 7 Chargrove Close (5 rooms)
  ('cc300000-0000-4000-8000-000000000006', v_tenant, v_p_chargrove, 'room', 'ENS5', 'occupied', false, null,         1350, 1350, 1350, false, 'furnished', 'cc500000-0000-4000-8000-000000000003'),
  ('cc300000-0000-4000-8000-000000000007', v_tenant, v_p_chargrove, 'room', 'D4',   'renewal',  false, '2026-05-31', 1075, 1075, 1075, false, 'furnished', 'cc500000-0000-4000-8000-000000000007'),
  ('cc300000-0000-4000-8000-000000000008', v_tenant, v_p_chargrove, 'room', 'D3',   'occupied', false, '2026-09-15', 1000, 1000, 1000, false, 'furnished', 'cc500000-0000-4000-8000-000000000037'),
  ('cc300000-0000-4000-8000-000000000009', v_tenant, v_p_chargrove, 'room', 'D1',   'occupied', false, '2026-10-01',  950,  950,  950, false, 'furnished', 'cc500000-0000-4000-8000-000000000048'),
  ('cc300000-0000-4000-8000-00000000000a', v_tenant, v_p_chargrove, 'room', 'ENS2', 'occupied', false, '2026-08-31', 1300, 1300, 1300, false, 'furnished', 'cc500000-0000-4000-8000-000000000030'),

  -- 1A Court Street, Flat 1 (4 rooms)
  ('cc300000-0000-4000-8000-00000000000b', v_tenant, v_p_court1, 'room', 'M1', 'occupied', false, null,         1130, 1130, 1130, false, 'furnished', 'cc500000-0000-4000-8000-000000000004'),
  ('cc300000-0000-4000-8000-00000000000c', v_tenant, v_p_court1, 'room', 'D3', 'occupied', false, null,         1030, 1030, 1030, false, 'furnished', 'cc500000-0000-4000-8000-000000000005'),
  ('cc300000-0000-4000-8000-00000000000d', v_tenant, v_p_court1, 'room', 'D2', 'occupied', false, '2026-09-01',  825,  825,  825, false, 'furnished', 'cc500000-0000-4000-8000-000000000033'),
  ('cc300000-0000-4000-8000-00000000000e', v_tenant, v_p_court1, 'room', 'D4', 'occupied', false, '2026-09-30',  920,  920,  920, false, 'furnished', 'cc500000-0000-4000-8000-000000000043'),

  -- 15 Everard House (4 rooms)
  ('cc300000-0000-4000-8000-00000000000f', v_tenant, v_p_everard, 'room', 'M4', 'renewal',  false, '2026-05-02', 1200, 1200, 1200, false, 'furnished', 'cc500000-0000-4000-8000-000000000006'),
  ('cc300000-0000-4000-8000-000000000010', v_tenant, v_p_everard, 'room', 'D3', 'occupied', false, '2026-06-30',  870,  870,  870, false, 'furnished', 'cc500000-0000-4000-8000-000000000014'),
  ('cc300000-0000-4000-8000-000000000011', v_tenant, v_p_everard, 'room', 'D1', 'renewal',  false, '2026-05-31',  950,  950,  950, false, 'furnished', 'cc500000-0000-4000-8000-000000000009'),
  ('cc300000-0000-4000-8000-000000000012', v_tenant, v_p_everard, 'room', 'D2', 'occupied', false, '2026-08-01', 1040, 1040, 1040, false, 'furnished', 'cc500000-0000-4000-8000-000000000022'),

  -- 149 Trundley's Road (5 rooms; D1 -> Ojas; Bilal kept in pm_tenants only)
  ('cc300000-0000-4000-8000-000000000013', v_tenant, v_p_trundley, 'room', 'D1',   'occupied', false, '2026-09-18',  975,  975,  975, false, 'furnished', 'cc500000-0000-4000-8000-000000000039'),
  ('cc300000-0000-4000-8000-000000000014', v_tenant, v_p_trundley, 'room', 'D5',   'occupied', false, '2026-08-01', 1000, 1000, 1000, false, 'furnished', 'cc500000-0000-4000-8000-000000000021'),
  ('cc300000-0000-4000-8000-000000000015', v_tenant, v_p_trundley, 'room', 'D4',   'occupied', false, '2026-08-30',  950,  950,  950, false, 'furnished', 'cc500000-0000-4000-8000-000000000026'),
  ('cc300000-0000-4000-8000-000000000016', v_tenant, v_p_trundley, 'room', 'ENS3', 'occupied', false, '2026-09-01', 1275, 1275, 1275, false, 'furnished', 'cc500000-0000-4000-8000-000000000031'),
  ('cc300000-0000-4000-8000-000000000017', v_tenant, v_p_trundley, 'room', 'D2',   'occupied', false, '2026-10-01',  955,  955,  955, false, 'furnished', 'cc500000-0000-4000-8000-000000000046'),

  -- 129 Boundaries Road (6 rooms; D4 has rent listed but no tenant data in source)
  ('cc300000-0000-4000-8000-000000000018', v_tenant, v_p_boundaries, 'room', 'D3', 'renewal',  false, '2026-05-31', 1025, 1025, 1025, false, 'furnished', 'cc500000-0000-4000-8000-000000000010'),
  ('cc300000-0000-4000-8000-000000000019', v_tenant, v_p_boundaries, 'room', 'D2', 'occupied', false, '2026-06-30',  975,  975,  975, false, 'furnished', 'cc500000-0000-4000-8000-000000000016'),
  ('cc300000-0000-4000-8000-00000000001a', v_tenant, v_p_boundaries, 'room', 'D1', 'occupied', false, '2026-08-31', 1050, 1050, 1050, false, 'furnished', 'cc500000-0000-4000-8000-000000000029'),
  ('cc300000-0000-4000-8000-00000000001b', v_tenant, v_p_boundaries, 'room', 'D6', 'occupied', false, '2026-09-16', 1030, 1030, 1030, false, 'furnished', 'cc500000-0000-4000-8000-000000000038'),
  ('cc300000-0000-4000-8000-00000000001c', v_tenant, v_p_boundaries, 'room', 'M5', 'occupied', false, '2026-09-27', 1090, 1090, 1090, false, 'furnished', 'cc500000-0000-4000-8000-000000000041'),
  ('cc300000-0000-4000-8000-00000000001d', v_tenant, v_p_boundaries, 'room', 'D4', 'occupied', false, '2026-09-30',  950,  950,  950, false, 'furnished', null),

  -- 20 Park West (3 rooms)
  ('cc300000-0000-4000-8000-00000000001e', v_tenant, v_p_parkwest, 'room', 'M3', 'renewal',  false, '2026-05-31', 1475, 1475, 1475, false, 'furnished', 'cc500000-0000-4000-8000-000000000011'),
  ('cc300000-0000-4000-8000-00000000001f', v_tenant, v_p_parkwest, 'room', 'D2', 'occupied', false, '2026-05-31', 1200, 1200, 1200, false, 'furnished', 'cc500000-0000-4000-8000-000000000012'),
  ('cc300000-0000-4000-8000-000000000020', v_tenant, v_p_parkwest, 'room', 'M1', 'occupied', false, '2026-05-03', 1475, 1475, 1475, false, 'furnished', 'cc500000-0000-4000-8000-000000000050'),

  -- 1A Court Street, Flat 2 (4 rooms; M1 vacant/booked, no tenant data)
  ('cc300000-0000-4000-8000-000000000021', v_tenant, v_p_court2, 'room', 'M1', 'available', false, '2026-06-10', 1150, 1150, 1150, false, 'furnished', null),
  ('cc300000-0000-4000-8000-000000000022', v_tenant, v_p_court2, 'room', 'D3', 'occupied',  false, '2026-08-01', 1000, 1000, 1000, false, 'furnished', 'cc500000-0000-4000-8000-000000000020'),
  ('cc300000-0000-4000-8000-000000000023', v_tenant, v_p_court2, 'room', 'D2', 'occupied',  false, '2026-09-01',  885,  885,  885, false, 'furnished', 'cc500000-0000-4000-8000-000000000034'),
  ('cc300000-0000-4000-8000-000000000024', v_tenant, v_p_court2, 'room', 'D4', 'occupied',  false, '2026-09-30',  925,  925,  925, false, 'furnished', 'cc500000-0000-4000-8000-000000000044'),

  -- 25 Alloa Road (5 rooms)
  ('cc300000-0000-4000-8000-000000000025', v_tenant, v_p_alloa, 'room', 'D2', 'occupied', false, '2026-06-30',  850,  850,  850, false, 'furnished', 'cc500000-0000-4000-8000-000000000017'),
  ('cc300000-0000-4000-8000-000000000026', v_tenant, v_p_alloa, 'room', 'D3', 'occupied', false, '2026-07-31',  980,  980,  980, false, 'furnished', 'cc500000-0000-4000-8000-000000000019'),
  ('cc300000-0000-4000-8000-000000000027', v_tenant, v_p_alloa, 'room', 'D5', 'occupied', false, '2026-09-01', 1120, 1160, 1160, false, 'furnished', 'cc500000-0000-4000-8000-000000000032'),
  ('cc300000-0000-4000-8000-000000000028', v_tenant, v_p_alloa, 'room', 'D4', 'occupied', false, '2026-09-26',  900,  900,  900, false, 'furnished', 'cc500000-0000-4000-8000-000000000040'),
  ('cc300000-0000-4000-8000-000000000029', v_tenant, v_p_alloa, 'room', 'D1', 'occupied', false, '2026-10-01', 1050, 1050, 1050, false, 'furnished', 'cc500000-0000-4000-8000-000000000045'),

  -- 9 Ramar House (4 rooms; M3 has rent listed but no tenant data in source)
  ('cc300000-0000-4000-8000-00000000002a', v_tenant, v_p_ramar, 'room', 'D2', 'occupied', false, '2026-06-30', 1000, 1000, 1000, false, 'furnished', 'cc500000-0000-4000-8000-000000000018'),
  ('cc300000-0000-4000-8000-00000000002b', v_tenant, v_p_ramar, 'room', 'M3', 'occupied', false, '2026-08-08',  990,  990,  990, false, 'furnished', null),
  ('cc300000-0000-4000-8000-00000000002c', v_tenant, v_p_ramar, 'room', 'M4', 'renewal',  false, '2026-06-01', 1300, 1300, 1300, false, 'furnished', 'cc500000-0000-4000-8000-000000000051'),
  ('cc300000-0000-4000-8000-00000000002d', v_tenant, v_p_ramar, 'room', 'D1', 'occupied', false, '2026-10-01',  950,  950,  950, false, 'furnished', 'cc500000-0000-4000-8000-000000000047'),

  -- 9A Plough Way (3 rooms; D2 -> couples allowed)
  ('cc300000-0000-4000-8000-00000000002e', v_tenant, v_p_plough, 'room', 'M3', 'occupied', false, '2026-08-11',  950, 1000, 1000, false, 'furnished', 'cc500000-0000-4000-8000-000000000024'),
  ('cc300000-0000-4000-8000-00000000002f', v_tenant, v_p_plough, 'room', 'D1', 'occupied', false, '2026-09-03',  950,  950,  950, false, 'furnished', 'cc500000-0000-4000-8000-000000000035'),
  ('cc300000-0000-4000-8000-000000000030', v_tenant, v_p_plough, 'room', 'D2', 'occupied', false, '2026-10-04',  900,  900,  900, true,  'furnished', 'cc500000-0000-4000-8000-000000000049'),

  -- 81 St Michael's Street (4 rooms)
  ('cc300000-0000-4000-8000-000000000031', v_tenant, v_p_stmichael, 'room', 'B',    'occupied', false, '2026-08-31', 1250, 1250, 1250, false, 'furnished', 'cc500000-0000-4000-8000-000000000027'),
  ('cc300000-0000-4000-8000-000000000032', v_tenant, v_p_stmichael, 'room', 'ENSA', 'occupied', false, '2026-08-31', 1650, 1650, 1650, false, 'furnished', 'cc500000-0000-4000-8000-000000000028'),
  ('cc300000-0000-4000-8000-000000000033', v_tenant, v_p_stmichael, 'room', 'D',    'occupied', false, '2026-09-06', 1280, 1280, 1280, false, 'furnished', 'cc500000-0000-4000-8000-000000000036'),
  ('cc300000-0000-4000-8000-000000000034', v_tenant, v_p_stmichael, 'room', 'C',    'occupied', false, '2027-04-30', 1300, 1300, 1300, false, 'furnished', 'cc500000-0000-4000-8000-000000000052')
  on conflict (id) do nothing;

  -- ─── Keybox codes ──────────────────────────────────────────
  insert into public.keys (id, tenant_id, property_id, set_name, copy_label, status, notes) values
  ('cc400000-0000-4000-8000-000000000001', v_tenant, v_p_chargrove,  'Keybox', 'Code', 'in_office', 'Zero770'),
  ('cc400000-0000-4000-8000-000000000002', v_tenant, v_p_ramar,      'Keybox', 'Code', 'in_office', '909'),
  ('cc400000-0000-4000-8000-000000000003', v_tenant, v_p_everard,    'Keybox', 'Code', 'in_office', '1705'),
  ('cc400000-0000-4000-8000-000000000004', v_tenant, v_p_boundaries, 'Keybox', 'Code', 'in_office', '1320'),
  ('cc400000-0000-4000-8000-000000000005', v_tenant, v_p_court1,     'Keybox', 'Code', 'in_office', '101'),
  ('cc400000-0000-4000-8000-000000000006', v_tenant, v_p_court2,     'Keybox', 'Code', 'in_office', '101'),
  ('cc400000-0000-4000-8000-000000000007', v_tenant, v_p_alloa,      'Keybox', 'Code', 'in_office', '2525'),
  ('cc400000-0000-4000-8000-000000000008', v_tenant, v_p_plough,     'Keybox', 'Code', 'in_office', '5454')
  on conflict (id) do nothing;
end $$;
