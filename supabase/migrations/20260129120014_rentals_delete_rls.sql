drop policy if exists "rentals delete" on rental_codes;

create policy "rentals delete"
on rental_codes for delete
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or (assisted_by_agent_id = auth.uid() and status = 'pending')
  )
);
