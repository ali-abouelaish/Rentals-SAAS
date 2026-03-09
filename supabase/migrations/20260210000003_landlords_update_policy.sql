-- Allow any authenticated tenant user to update landlords (not just admin)
drop policy if exists "landlords update" on landlords;

create policy "landlords update"
on landlords for update
using (tenant_id = current_tenant_id())
with check (tenant_id = current_tenant_id());
