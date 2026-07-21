-- AP Real Estate tenant / rent-roll update
-- Source: PORTFOLIO AVAILIABILITY.pdf (provided 2026-07-20)
-- Follows on from 20260430000001_ap_portfolio_import.sql /
-- 20260430000002_ap_portfolio_import_b5b00020.sql, which only imported
-- properties + units without tenant (pm_tenants) data.
--
-- What this migration does, for each existing AP tenant (11111111... and
-- b5b00020...):
--   1. Updates existing units' status / price / available_date from the new
--      rent roll, and creates a pm_tenants row + links units.pm_tenant_id
--      for every unit where the source names a current/incoming resident.
--   2. Adds a second Barnando Gardens room "A2" — the source again lists two
--      "Barnando Gardens A" rows (same pattern as the Broxbourne "A"/"A2"
--      duplicate noted in the original import); both are kept.
--   3. Adds two properties that appear in this rent roll but were not in the
--      original portfolio import: 53 Fursecroft (Marylebone, 6 rooms) and
--      19 Birchfield House (Canary Wharf, 4 rooms; keybox code 1234 per the
--      source's keybox list), plus their units and tenants.
--
-- Data interpretations:
--   • Status legend (matches the header note in 20260430000001): NOW ->
--     available; NOW-BOOKED / date-BOOKED -> booked; bare date -> occupied
--     with available_date = the date; ROLLING -> occupied, no
--     available_date (periodic tenancy, no fixed end).
--   • "17 Sep 2026 Broxbourne House A" (£920, Myat Noe Pwint) matches the
--     existing "A2" unit's date/price exactly, so it updates A2. "Broxbourne
--     House A" ROLLING (£1,000, Edward Galloway) updates room A.
--   • A second "Broxbourne House A" row marked TBC (£1,000, no tenant) is a
--     duplicate of the ROLLING row above (same postcode/price) and is not
--     imported as a separate unit.
--   • "Netherby House D Battersea" — the property's area on file is Lambeth;
--     "Battersea" in the source is treated as a labelling slip, not a
--     property move.
--   • property_contracts are NOT created here — as with the Horizon Dreams
--     import, the rent roll gives no contract start date or deposit amount
--     distinct from rent, so tenancy dates continue to live on
--     units.available_date only.
--   • Email/date-of-birth are only populated where the source's contact
--     block pairs them directly with a name (11 tenants). All other
--     tenants only got name/phone from the room list. Where phone was also
--     blank, placeholders ('unknown' / <name>@aprealestate.local) are used,
--     matching the placeholder convention in the Horizon Dreams import.
--   • Idempotent: fixed UUIDs + on conflict (id) do nothing.

do $$
declare
  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_pm_id  uuid;
begin
  if not exists (select 1 from public.tenants where id = v_tenant) then
    return;
  end if;

  -- ─── Update existing units (status/price/availability) ───────
  -- Barnando Gardens C
  update public.units set status = 'booked', available_date = null,
    min_price_pcm = 1025, max_price_pcm = 1025
   where id = 'aa300001-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- Barnando Gardens D
  update public.units set status = 'available', available_date = null,
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'aa300001-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- Barnando Gardens A
  update public.units set status = 'available', available_date = null,
    min_price_pcm = 1100, max_price_pcm = 1100
   where id = 'aa300001-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- Barnando Gardens E
  update public.units set status = 'occupied', available_date = '2027-07-31',
    min_price_pcm = 890, max_price_pcm = 890
   where id = 'aa300001-0000-4000-8000-000000000005' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000001';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Jadzia Ka-Yu Yeung', 'yeungjadzia@gmail.com', '+353873363698',
    null, 'Irish', 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300001-0000-4000-8000-000000000005' and tenant_id = v_tenant;

  -- 23 Netherby House E
  update public.units set status = 'booked', available_date = '2026-07-26',
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'aa300002-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000002';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Philip Debinski', 'philip.debinski@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300002-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 23 Netherby House C
  update public.units set status = 'occupied', available_date = '2026-09-24',
    min_price_pcm = 965, max_price_pcm = 965
   where id = 'aa300002-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000003';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'George Lysaght', 'george.lysaght@aprealestate.local', '31639170003',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300002-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 23 Netherby House B
  update public.units set status = 'occupied', available_date = '2026-10-29',
    min_price_pcm = 990, max_price_pcm = 990
   where id = 'aa300002-0000-4000-8000-000000000004' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000004';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Jacob Newman', 'jacob.newman@aprealestate.local', '07544576005',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300002-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- 23 Netherby House M1
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1150, max_price_pcm = 1150
   where id = 'aa300002-0000-4000-8000-000000000005' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000005';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Tamas Gretzio', 'tamas.gretzio@aprealestate.local', '07841488952',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300002-0000-4000-8000-000000000005' and tenant_id = v_tenant;

  -- 23 Netherby House D
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 960, max_price_pcm = 960
   where id = 'aa300002-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000006';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Katie Malone', 'katie.malone@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300002-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 17 Broxbourne House D
  update public.units set status = 'occupied', available_date = '2026-09-06',
    min_price_pcm = 1150, max_price_pcm = 1150
   where id = 'aa300003-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000007';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Haroon Zafar', 'haroon.zafar@aprealestate.local', '7385255518',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300003-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 17 Broxbourne House A2
  update public.units set status = 'occupied', available_date = '2026-09-17',
    min_price_pcm = 920, max_price_pcm = 920
   where id = 'aa300003-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000008';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Myat Noe Pwint', 'myat.noe.pwint@aprealestate.local', '07789206610',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300003-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 17 Broxbourne House A
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1000, max_price_pcm = 1000
   where id = 'aa300003-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000009';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Edward Galloway', 'Egalloway2001@outlook.com', '07872991652',
    '2001-10-21', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300003-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 60b Evelyn Street D2
  update public.units set status = 'occupied', available_date = '2026-08-31',
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'aa300004-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000010';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Teah Wright', 'teah.wright@aprealestate.local', '+61 491 027 792',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300004-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 60b Evelyn Street D3
  update public.units set status = 'occupied', available_date = '2026-09-15',
    min_price_pcm = 1090, max_price_pcm = 1090
   where id = 'aa300004-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000011';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Kateryna Ignatieva', 'kateryna.ignatieva@aprealestate.local', '357 95115204',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300004-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 60b Evelyn Street D1
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1070, max_price_pcm = 1070
   where id = 'aa300004-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000012';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Ava Demir', 'ava.demir@aprealestate.local', '07768409490',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300004-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 2 Ramsey Street A
  update public.units set status = 'occupied', available_date = '2027-01-15',
    min_price_pcm = 1100, max_price_pcm = 1100
   where id = 'aa300005-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000013';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Karol Kopf', 'karol.kopf@aprealestate.local', '07300409605',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300005-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 2 Ramsey Street C
  update public.units set status = 'occupied', available_date = '2027-01-15',
    min_price_pcm = 955, max_price_pcm = 955
   where id = 'aa300005-0000-4000-8000-000000000004' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000014';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Vaness Kvak', 'vaness.kvak@aprealestate.local', '07576909287',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300005-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- 2 Ramsey Street D
  update public.units set status = 'occupied', available_date = '2027-01-15',
    min_price_pcm = 1000, max_price_pcm = 1000
   where id = 'aa300005-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000015';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Matthew Gold', 'matthew.gold@aprealestate.local', '1 631626-7102',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300005-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 2 Ramsey Street B
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 890, max_price_pcm = 890
   where id = 'aa300005-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000016';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Jaakko Ahdekivi', 'jaakko.ahdekivi@aprealestate.local', '358503034150',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300005-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 48 Ann Moss Way C
  update public.units set status = 'booked', available_date = '2026-08-01',
    min_price_pcm = 980, max_price_pcm = 980
   where id = 'aa300006-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000017';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Ayushi', 'ayushi@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300006-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 48 Ann Moss Way D
  update public.units set status = 'occupied', available_date = '2026-09-01',
    min_price_pcm = 1000, max_price_pcm = 1000
   where id = 'aa300006-0000-4000-8000-000000000004' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000018';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'George Peramata', 'george.peramata@aprealestate.local', '7742430257',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300006-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- 48 Ann Moss Way B
  update public.units set status = 'booked', available_date = '2026-09-04',
    min_price_pcm = 980, max_price_pcm = 980
   where id = 'aa300006-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000019';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Juilen Pinauit', 'juilen.pinauit@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300006-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 48 Ann Moss Way A
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1160, max_price_pcm = 1160
   where id = 'aa300006-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000020';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Thomas Theodore Wright', 'theowright115@gmail.com', '07565625953',
    '2002-02-19', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300006-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 25 John Silikin Lane
  update public.units set status = 'occupied', available_date = '2026-09-30',
    min_price_pcm = 1575, max_price_pcm = 1575
   where id = 'aa300007-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000021';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Frank Bongani Masileia', 'frank.bongani.masileia@aprealestate.local', '27 720735270',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300007-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 59 Chicksand House D2
  update public.units set status = 'occupied', available_date = '2026-08-31',
    min_price_pcm = 980, max_price_pcm = 980
   where id = 'aa300008-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000022';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Melanie Santos', 'melanie.santos@aprealestate.local', '07506621280',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300008-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 59 Chicksand House D1
  update public.units set status = 'occupied', available_date = '2026-09-04',
    min_price_pcm = 1100, max_price_pcm = 1100
   where id = 'aa300008-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000023';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Kathryn Allan', 'kathryn.allan@aprealestate.local', '07776033599',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300008-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 59 Chicksand House D3
  update public.units set status = 'occupied', available_date = '2026-09-30',
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'aa300008-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'aa500000-0000-4000-8000-000000000024';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Sarah Jane Melia', 'sarah.jane.melia@aprealestate.local', '+353852249853',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300008-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- ─── New unit: Barnando Gardens A2 (2nd 'A' room in source, see note) ───
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa300001-0000-4000-8000-000000000006', v_tenant, 'aa100000-0000-4000-8000-000000000001', 'room', 'A2', 'booked', false, '2026-08-31', 935, 935, 935, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000025';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Gabriel Giacomelli', 'gabriel.giacomelli@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300001-0000-4000-8000-000000000006' and tenant_id = v_tenant;

  -- ─── New property: 53 Fursecroft (Marylebone) ──────────────────
  insert into public.properties (id, tenant_id, portfolio_id, property_type, name, address_line_1, postcode, area, total_rooms, total_bathrooms, furnished, broadband, washing_machine, central_heating)
  select 'aa100000-0000-4000-8000-000000000009', v_tenant, id, 'hmo', '53 Fursecroft', '53 Fursecroft', 'W1H 5LG', 'Marylebone', 6, 2, true, true, true, true
    from public.portfolios where tenant_id = v_tenant and name = 'AP' limit 1
  on conflict (id) do nothing;
  -- Fursecroft D4
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa300009-0000-4000-8000-000000000001', v_tenant, 'aa100000-0000-4000-8000-000000000009', 'room', 'D4', 'booked', false, '2026-07-23', 1525, 1525, 1525, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000026';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Arnav Sherpuri', 'arnavsherpuri@gmail.com', '+1 551 289 4237',
    '2007-04-27', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300009-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- Fursecroft D5
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa300009-0000-4000-8000-000000000002', v_tenant, 'aa100000-0000-4000-8000-000000000009', 'room', 'D5', 'occupied', false, '2026-08-31', 1525, 1525, 1525, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000027';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Eduardo Menasseh de Faria Glinsman', 'eduardoglinsman@icloud.com', '+5512988505986',
    '2003-04-04', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300009-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- Fursecroft D2
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa300009-0000-4000-8000-000000000003', v_tenant, 'aa100000-0000-4000-8000-000000000009', 'room', 'D2', 'occupied', false, '2026-08-31', 1375, 1375, 1375, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000028';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Ignacia Manzanares', 'ignacia.manzanares@aprealestate.local', '+56993214464',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300009-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- Fursecroft D3
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa300009-0000-4000-8000-000000000004', v_tenant, 'aa100000-0000-4000-8000-000000000009', 'room', 'D3', 'occupied', false, '2026-08-31', 1500, 1500, 1500, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000029';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Mattéo René Benjamin Rousseau', 'matteo.rousseau@live.fr', '+33618696147',
    '2002-05-28', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300009-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- Fursecroft ENS6
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa300009-0000-4000-8000-000000000005', v_tenant, 'aa100000-0000-4000-8000-000000000009', 'room', 'ENS6', 'occupied', false, null, 1750, 1750, 1750, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000030';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Sudeshna Das', 'd.sudeshna99@gmail.com', '+44 7810 242948',
    '1999-12-07', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300009-0000-4000-8000-000000000005' and tenant_id = v_tenant;

  -- Fursecroft M1
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa300009-0000-4000-8000-000000000006', v_tenant, 'aa100000-0000-4000-8000-000000000009', 'room', 'M1', 'occupied', false, null, 1650, 1650, 1650, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000031';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Antoine Olivier Cauzot', 'antoine.olivier.cauzot@aprealestate.local', '+33 6 77 31 83 08',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa300009-0000-4000-8000-000000000006' and tenant_id = v_tenant;

  -- ─── New property: 19 Birchfield House (Canary Wharf) ───────────
  insert into public.properties (id, tenant_id, portfolio_id, property_type, name, address_line_1, postcode, area, total_rooms, total_bathrooms, furnished, broadband, washing_machine, central_heating)
  select 'aa100000-0000-4000-8000-00000000000a', v_tenant, id, 'hmo', '19 Birchfield House', '19 Birchfield House', 'E14 8EY', 'Canary Wharf', 4, 2, true, true, true, true
    from public.portfolios where tenant_id = v_tenant and name = 'AP' limit 1
  on conflict (id) do nothing;
  update public.properties set separate_wc = true where id = 'aa100000-0000-4000-8000-00000000000a';
  -- Birchfield House 2
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa30000a-0000-4000-8000-000000000001', v_tenant, 'aa100000-0000-4000-8000-00000000000a', 'room', '2', 'booked', false, '2026-08-29', 1025, 1025, 1025, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000032';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Yi Lin Koh', 'yilinnay@gmail.com', '07757232634',
    '2001-03-29', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa30000a-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- Birchfield House 1
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa30000a-0000-4000-8000-000000000002', v_tenant, 'aa100000-0000-4000-8000-00000000000a', 'room', '1', 'occupied', false, null, 1150, 1150, 1150, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000033';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Leon Wedderburn', 'wedderburnleon@gmail.com', '07946626256',
    '2003-07-18', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa30000a-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- Birchfield House 3
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa30000a-0000-4000-8000-000000000003', v_tenant, 'aa100000-0000-4000-8000-00000000000a', 'room', '3', 'occupied', false, null, 1050, 1050, 1050, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000034';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Martina Rizzolo', 'rizzolo.martina01@gmail.com', '+39 3455872301',
    '2003-07-01', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa30000a-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- Birchfield House 4
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('aa30000a-0000-4000-8000-000000000004', v_tenant, 'aa100000-0000-4000-8000-00000000000a', 'room', '4', 'occupied', false, null, 1100, 1100, 1100, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'aa500000-0000-4000-8000-000000000035';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Sabina Georgiana Dorobantu', 'sabinadorobantu1@gmail.com', '+44 7460 559979',
    '2003-02-15', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'aa30000a-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- ─── Keybox code (page 10) ─────────────────────────────────────
  insert into public.keys (id, tenant_id, property_id, set_name, copy_label, status, notes)
  values ('aa400000-0000-4000-8000-000000000006', v_tenant, 'aa100000-0000-4000-8000-00000000000a', 'Keybox', 'Code', 'in_office', '1234')
  on conflict (id) do nothing;

  raise notice 'AP Real Estate tenant import complete for tenant % (aa)', v_tenant;
end $$;

do $$
declare
  v_tenant uuid := 'b5b00020-9b30-4288-8ab4-a1e6c900dc96';
  v_pm_id  uuid;
begin
  if not exists (select 1 from public.tenants where id = v_tenant) then
    return;
  end if;

  -- ─── Update existing units (status/price/availability) ───────
  -- Barnando Gardens C
  update public.units set status = 'booked', available_date = null,
    min_price_pcm = 1025, max_price_pcm = 1025
   where id = 'bb300001-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- Barnando Gardens D
  update public.units set status = 'available', available_date = null,
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'bb300001-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- Barnando Gardens A
  update public.units set status = 'available', available_date = null,
    min_price_pcm = 1100, max_price_pcm = 1100
   where id = 'bb300001-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- Barnando Gardens E
  update public.units set status = 'occupied', available_date = '2027-07-31',
    min_price_pcm = 890, max_price_pcm = 890
   where id = 'bb300001-0000-4000-8000-000000000005' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000001';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Jadzia Ka-Yu Yeung', 'yeungjadzia@gmail.com', '+353873363698',
    null, 'Irish', 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300001-0000-4000-8000-000000000005' and tenant_id = v_tenant;

  -- 23 Netherby House E
  update public.units set status = 'booked', available_date = '2026-07-26',
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'bb300002-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000002';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Philip Debinski', 'philip.debinski@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300002-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 23 Netherby House C
  update public.units set status = 'occupied', available_date = '2026-09-24',
    min_price_pcm = 965, max_price_pcm = 965
   where id = 'bb300002-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000003';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'George Lysaght', 'george.lysaght@aprealestate.local', '31639170003',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300002-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 23 Netherby House B
  update public.units set status = 'occupied', available_date = '2026-10-29',
    min_price_pcm = 990, max_price_pcm = 990
   where id = 'bb300002-0000-4000-8000-000000000004' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000004';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Jacob Newman', 'jacob.newman@aprealestate.local', '07544576005',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300002-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- 23 Netherby House M1
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1150, max_price_pcm = 1150
   where id = 'bb300002-0000-4000-8000-000000000005' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000005';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Tamas Gretzio', 'tamas.gretzio@aprealestate.local', '07841488952',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300002-0000-4000-8000-000000000005' and tenant_id = v_tenant;

  -- 23 Netherby House D
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 960, max_price_pcm = 960
   where id = 'bb300002-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000006';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Katie Malone', 'katie.malone@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300002-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 17 Broxbourne House D
  update public.units set status = 'occupied', available_date = '2026-09-06',
    min_price_pcm = 1150, max_price_pcm = 1150
   where id = 'bb300003-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000007';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Haroon Zafar', 'haroon.zafar@aprealestate.local', '7385255518',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300003-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 17 Broxbourne House A2
  update public.units set status = 'occupied', available_date = '2026-09-17',
    min_price_pcm = 920, max_price_pcm = 920
   where id = 'bb300003-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000008';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Myat Noe Pwint', 'myat.noe.pwint@aprealestate.local', '07789206610',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300003-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 17 Broxbourne House A
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1000, max_price_pcm = 1000
   where id = 'bb300003-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000009';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Edward Galloway', 'Egalloway2001@outlook.com', '07872991652',
    '2001-10-21', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300003-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 60b Evelyn Street D2
  update public.units set status = 'occupied', available_date = '2026-08-31',
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'bb300004-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000010';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Teah Wright', 'teah.wright@aprealestate.local', '+61 491 027 792',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300004-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 60b Evelyn Street D3
  update public.units set status = 'occupied', available_date = '2026-09-15',
    min_price_pcm = 1090, max_price_pcm = 1090
   where id = 'bb300004-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000011';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Kateryna Ignatieva', 'kateryna.ignatieva@aprealestate.local', '357 95115204',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300004-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 60b Evelyn Street D1
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1070, max_price_pcm = 1070
   where id = 'bb300004-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000012';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Ava Demir', 'ava.demir@aprealestate.local', '07768409490',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300004-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 2 Ramsey Street A
  update public.units set status = 'occupied', available_date = '2027-01-15',
    min_price_pcm = 1100, max_price_pcm = 1100
   where id = 'bb300005-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000013';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Karol Kopf', 'karol.kopf@aprealestate.local', '07300409605',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300005-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 2 Ramsey Street C
  update public.units set status = 'occupied', available_date = '2027-01-15',
    min_price_pcm = 955, max_price_pcm = 955
   where id = 'bb300005-0000-4000-8000-000000000004' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000014';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Vaness Kvak', 'vaness.kvak@aprealestate.local', '07576909287',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300005-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- 2 Ramsey Street D
  update public.units set status = 'occupied', available_date = '2027-01-15',
    min_price_pcm = 1000, max_price_pcm = 1000
   where id = 'bb300005-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000015';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Matthew Gold', 'matthew.gold@aprealestate.local', '1 631626-7102',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300005-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 2 Ramsey Street B
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 890, max_price_pcm = 890
   where id = 'bb300005-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000016';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Jaakko Ahdekivi', 'jaakko.ahdekivi@aprealestate.local', '358503034150',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300005-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 48 Ann Moss Way C
  update public.units set status = 'booked', available_date = '2026-08-01',
    min_price_pcm = 980, max_price_pcm = 980
   where id = 'bb300006-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000017';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Ayushi', 'ayushi@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300006-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 48 Ann Moss Way D
  update public.units set status = 'occupied', available_date = '2026-09-01',
    min_price_pcm = 1000, max_price_pcm = 1000
   where id = 'bb300006-0000-4000-8000-000000000004' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000018';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'George Peramata', 'george.peramata@aprealestate.local', '7742430257',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300006-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- 48 Ann Moss Way B
  update public.units set status = 'booked', available_date = '2026-09-04',
    min_price_pcm = 980, max_price_pcm = 980
   where id = 'bb300006-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000019';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Juilen Pinauit', 'juilen.pinauit@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300006-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 48 Ann Moss Way A
  update public.units set status = 'occupied', available_date = null,
    min_price_pcm = 1160, max_price_pcm = 1160
   where id = 'bb300006-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000020';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Thomas Theodore Wright', 'theowright115@gmail.com', '07565625953',
    '2002-02-19', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300006-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 25 John Silikin Lane
  update public.units set status = 'occupied', available_date = '2026-09-30',
    min_price_pcm = 1575, max_price_pcm = 1575
   where id = 'bb300007-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000021';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Frank Bongani Masileia', 'frank.bongani.masileia@aprealestate.local', '27 720735270',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300007-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- 59 Chicksand House D2
  update public.units set status = 'occupied', available_date = '2026-08-31',
    min_price_pcm = 980, max_price_pcm = 980
   where id = 'bb300008-0000-4000-8000-000000000003' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000022';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Melanie Santos', 'melanie.santos@aprealestate.local', '07506621280',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300008-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- 59 Chicksand House D1
  update public.units set status = 'occupied', available_date = '2026-09-04',
    min_price_pcm = 1100, max_price_pcm = 1100
   where id = 'bb300008-0000-4000-8000-000000000002' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000023';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Kathryn Allan', 'kathryn.allan@aprealestate.local', '07776033599',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300008-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- 59 Chicksand House D3
  update public.units set status = 'occupied', available_date = '2026-09-30',
    min_price_pcm = 975, max_price_pcm = 975
   where id = 'bb300008-0000-4000-8000-000000000001' and tenant_id = v_tenant;
  v_pm_id := 'bb500000-0000-4000-8000-000000000024';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Sarah Jane Melia', 'sarah.jane.melia@aprealestate.local', '+353852249853',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300008-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- ─── New unit: Barnando Gardens A2 (2nd 'A' room in source, see note) ───
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb300001-0000-4000-8000-000000000006', v_tenant, 'bb100000-0000-4000-8000-000000000001', 'room', 'A2', 'booked', false, '2026-08-31', 935, 935, 935, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000025';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Gabriel Giacomelli', 'gabriel.giacomelli@aprealestate.local', 'unknown',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300001-0000-4000-8000-000000000006' and tenant_id = v_tenant;

  -- ─── New property: 53 Fursecroft (Marylebone) ──────────────────
  insert into public.properties (id, tenant_id, portfolio_id, property_type, name, address_line_1, postcode, area, total_rooms, total_bathrooms, furnished, broadband, washing_machine, central_heating)
  select 'bb100000-0000-4000-8000-000000000009', v_tenant, id, 'hmo', '53 Fursecroft', '53 Fursecroft', 'W1H 5LG', 'Marylebone', 6, 2, true, true, true, true
    from public.portfolios where tenant_id = v_tenant and name = 'AP' limit 1
  on conflict (id) do nothing;
  -- Fursecroft D4
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb300009-0000-4000-8000-000000000001', v_tenant, 'bb100000-0000-4000-8000-000000000009', 'room', 'D4', 'booked', false, '2026-07-23', 1525, 1525, 1525, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000026';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Arnav Sherpuri', 'arnavsherpuri@gmail.com', '+1 551 289 4237',
    '2007-04-27', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300009-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- Fursecroft D5
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb300009-0000-4000-8000-000000000002', v_tenant, 'bb100000-0000-4000-8000-000000000009', 'room', 'D5', 'occupied', false, '2026-08-31', 1525, 1525, 1525, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000027';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Eduardo Menasseh de Faria Glinsman', 'eduardoglinsman@icloud.com', '+5512988505986',
    '2003-04-04', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300009-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- Fursecroft D2
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb300009-0000-4000-8000-000000000003', v_tenant, 'bb100000-0000-4000-8000-000000000009', 'room', 'D2', 'occupied', false, '2026-08-31', 1375, 1375, 1375, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000028';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Ignacia Manzanares', 'ignacia.manzanares@aprealestate.local', '+56993214464',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300009-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- Fursecroft D3
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb300009-0000-4000-8000-000000000004', v_tenant, 'bb100000-0000-4000-8000-000000000009', 'room', 'D3', 'occupied', false, '2026-08-31', 1500, 1500, 1500, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000029';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Mattéo René Benjamin Rousseau', 'matteo.rousseau@live.fr', '+33618696147',
    '2002-05-28', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300009-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- Fursecroft ENS6
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb300009-0000-4000-8000-000000000005', v_tenant, 'bb100000-0000-4000-8000-000000000009', 'room', 'ENS6', 'occupied', false, null, 1750, 1750, 1750, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000030';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Sudeshna Das', 'd.sudeshna99@gmail.com', '+44 7810 242948',
    '1999-12-07', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300009-0000-4000-8000-000000000005' and tenant_id = v_tenant;

  -- Fursecroft M1
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb300009-0000-4000-8000-000000000006', v_tenant, 'bb100000-0000-4000-8000-000000000009', 'room', 'M1', 'occupied', false, null, 1650, 1650, 1650, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000031';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Antoine Olivier Cauzot', 'antoine.olivier.cauzot@aprealestate.local', '+33 6 77 31 83 08',
    null, null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb300009-0000-4000-8000-000000000006' and tenant_id = v_tenant;

  -- ─── New property: 19 Birchfield House (Canary Wharf) ───────────
  insert into public.properties (id, tenant_id, portfolio_id, property_type, name, address_line_1, postcode, area, total_rooms, total_bathrooms, furnished, broadband, washing_machine, central_heating)
  select 'bb100000-0000-4000-8000-00000000000a', v_tenant, id, 'hmo', '19 Birchfield House', '19 Birchfield House', 'E14 8EY', 'Canary Wharf', 4, 2, true, true, true, true
    from public.portfolios where tenant_id = v_tenant and name = 'AP' limit 1
  on conflict (id) do nothing;
  update public.properties set separate_wc = true where id = 'bb100000-0000-4000-8000-00000000000a';
  -- Birchfield House 2
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb30000a-0000-4000-8000-000000000001', v_tenant, 'bb100000-0000-4000-8000-00000000000a', 'room', '2', 'booked', false, '2026-08-29', 1025, 1025, 1025, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000032';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Yi Lin Koh', 'yilinnay@gmail.com', '07757232634',
    '2001-03-29', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb30000a-0000-4000-8000-000000000001' and tenant_id = v_tenant;

  -- Birchfield House 1
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb30000a-0000-4000-8000-000000000002', v_tenant, 'bb100000-0000-4000-8000-00000000000a', 'room', '1', 'occupied', false, null, 1150, 1150, 1150, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000033';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Leon Wedderburn', 'wedderburnleon@gmail.com', '07946626256',
    '2003-07-18', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb30000a-0000-4000-8000-000000000002' and tenant_id = v_tenant;

  -- Birchfield House 3
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb30000a-0000-4000-8000-000000000003', v_tenant, 'bb100000-0000-4000-8000-00000000000a', 'room', '3', 'occupied', false, null, 1050, 1050, 1050, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000034';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Martina Rizzolo', 'rizzolo.martina01@gmail.com', '+39 3455872301',
    '2003-07-01', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb30000a-0000-4000-8000-000000000003' and tenant_id = v_tenant;

  -- Birchfield House 4
  insert into public.units (id, tenant_id, property_id, unit_type, room_number, status, notice_given, available_date, min_price_pcm, max_price_pcm, deposit, couples_allowed, furnishings)
  values ('bb30000a-0000-4000-8000-000000000004', v_tenant, 'bb100000-0000-4000-8000-00000000000a', 'room', '4', 'occupied', false, null, 1100, 1100, 1100, false, 'furnished')
  on conflict (id) do nothing;
  v_pm_id := 'bb500000-0000-4000-8000-000000000035';
  insert into public.pm_tenants (id, tenant_id, full_name, email, phone, date_of_birth, nationality, notes, created_at, updated_at)
  values (v_pm_id, v_tenant, 'Sabina Georgiana Dorobantu', 'sabinadorobantu1@gmail.com', '+44 7460 559979',
    '2003-02-15', null, 'Imported from AP Real Estate portfolio PDF (2026-07-20).', now(), now())
  on conflict (id) do nothing;
  update public.units set pm_tenant_id = v_pm_id where id = 'bb30000a-0000-4000-8000-000000000004' and tenant_id = v_tenant;

  -- ─── Keybox code (page 10) ─────────────────────────────────────
  insert into public.keys (id, tenant_id, property_id, set_name, copy_label, status, notes)
  values ('bb400000-0000-4000-8000-000000000006', v_tenant, 'bb100000-0000-4000-8000-00000000000a', 'Keybox', 'Code', 'in_office', '1234')
  on conflict (id) do nothing;

  raise notice 'AP Real Estate tenant import complete for tenant % (bb)', v_tenant;
end $$;
