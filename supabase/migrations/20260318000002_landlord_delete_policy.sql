create policy "landlords delete"
  on landlords for delete
  using (tenant_id = current_tenant_id());
