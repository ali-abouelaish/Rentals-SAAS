-- Allow authenticated tenant users to create landlords for their tenant
create policy "landlords insert"
on landlords for insert
with check (tenant_id = current_tenant_id());
