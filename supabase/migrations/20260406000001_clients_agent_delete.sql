-- Allow agents to delete clients assigned to them (admins can delete any)
drop policy if exists "clients delete" on clients;
create policy "clients delete"
on clients for delete
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or assigned_agent_id = (select auth.uid())
  )
);
