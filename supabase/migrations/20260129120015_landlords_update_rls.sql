drop policy if exists "landlords update" on landlords;

create policy "landlords update"
on landlords for update
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());
