-- Properties Module: RLS Policies
-- All tables: SELECT open to all tenant users; INSERT/UPDATE/DELETE restricted to admins.

-- ============================================================
-- portfolios
-- ============================================================
drop policy if exists "portfolios select" on public.portfolios;
create policy "portfolios select" on public.portfolios
  for select using (tenant_id = current_tenant_id());

drop policy if exists "portfolios insert" on public.portfolios;
create policy "portfolios insert" on public.portfolios
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "portfolios update" on public.portfolios;
create policy "portfolios update" on public.portfolios
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "portfolios delete" on public.portfolios;
create policy "portfolios delete" on public.portfolios
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- owner_landlords
-- ============================================================
drop policy if exists "owner_landlords select" on public.owner_landlords;
create policy "owner_landlords select" on public.owner_landlords
  for select using (tenant_id = current_tenant_id());

drop policy if exists "owner_landlords insert" on public.owner_landlords;
create policy "owner_landlords insert" on public.owner_landlords
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "owner_landlords update" on public.owner_landlords;
create policy "owner_landlords update" on public.owner_landlords
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "owner_landlords delete" on public.owner_landlords;
create policy "owner_landlords delete" on public.owner_landlords
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- manager_landlords
-- ============================================================
drop policy if exists "manager_landlords select" on public.manager_landlords;
create policy "manager_landlords select" on public.manager_landlords
  for select using (tenant_id = current_tenant_id());

drop policy if exists "manager_landlords insert" on public.manager_landlords;
create policy "manager_landlords insert" on public.manager_landlords
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "manager_landlords update" on public.manager_landlords;
create policy "manager_landlords update" on public.manager_landlords
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "manager_landlords delete" on public.manager_landlords;
create policy "manager_landlords delete" on public.manager_landlords
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- properties
-- ============================================================
drop policy if exists "properties select" on public.properties;
create policy "properties select" on public.properties
  for select using (tenant_id = current_tenant_id());

drop policy if exists "properties insert" on public.properties;
create policy "properties insert" on public.properties
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "properties update" on public.properties;
create policy "properties update" on public.properties
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "properties delete" on public.properties;
create policy "properties delete" on public.properties
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- property_residents
-- ============================================================
drop policy if exists "property_residents select" on public.property_residents;
create policy "property_residents select" on public.property_residents
  for select using (tenant_id = current_tenant_id());

drop policy if exists "property_residents insert" on public.property_residents;
create policy "property_residents insert" on public.property_residents
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "property_residents update" on public.property_residents;
create policy "property_residents update" on public.property_residents
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "property_residents delete" on public.property_residents;
create policy "property_residents delete" on public.property_residents
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- units
-- ============================================================
drop policy if exists "units select" on public.units;
create policy "units select" on public.units
  for select using (tenant_id = current_tenant_id());

drop policy if exists "units insert" on public.units;
create policy "units insert" on public.units
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "units update" on public.units;
create policy "units update" on public.units
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "units delete" on public.units;
create policy "units delete" on public.units
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- unit_photos
-- ============================================================
drop policy if exists "unit_photos select" on public.unit_photos;
create policy "unit_photos select" on public.unit_photos
  for select using (tenant_id = current_tenant_id());

drop policy if exists "unit_photos insert" on public.unit_photos;
create policy "unit_photos insert" on public.unit_photos
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "unit_photos update" on public.unit_photos;
create policy "unit_photos update" on public.unit_photos
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "unit_photos delete" on public.unit_photos;
create policy "unit_photos delete" on public.unit_photos
  for delete using (tenant_id = current_tenant_id() and is_admin());
