-- Acquisition Insights module: RLS policies for evaluations table

-- Select: all tenant members can read evaluations
create policy "evaluations_select_tenant_members"
  on public.evaluations for select
  using (
    tenant_id = (
      select tenant_id from public.user_profiles
      where id = (select auth.uid())
    )
  );

-- Insert: admins/managers can create evaluations
create policy "evaluations_insert_admins"
  on public.evaluations for insert
  with check (
    tenant_id = (
      select tenant_id from public.user_profiles
      where id = (select auth.uid())
    )
    and (
      select role from public.user_profiles
      where id = (select auth.uid())
    ) in ('admin', 'super_admin', 'manager')
  );

-- Update: admins/managers can update evaluations
create policy "evaluations_update_admins"
  on public.evaluations for update
  using (
    tenant_id = (
      select tenant_id from public.user_profiles
      where id = (select auth.uid())
    )
    and (
      select role from public.user_profiles
      where id = (select auth.uid())
    ) in ('admin', 'super_admin', 'manager')
  );

-- Note: No delete policy — evaluations are never deleted per business rules.
-- Status can be changed to 'passed' but records must be retained.
