drop policy if exists "bonuses select" on bonuses;
drop policy if exists "bonuses insert" on bonuses;
drop policy if exists "bonuses update" on bonuses;
drop policy if exists "bonuses delete" on bonuses;

create policy "bonuses select"
on bonuses for select
using (tenant_id = current_tenant_id() and (is_admin() or agent_id = auth.uid()));

create policy "bonuses insert"
on bonuses for insert
with check (tenant_id = current_tenant_id() and agent_id = auth.uid());

create policy "bonuses update"
on bonuses for update
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or (agent_id = auth.uid() and status = 'pending')
  )
)
with check (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or (agent_id = auth.uid() and status = 'pending')
  )
);

create policy "bonuses delete"
on bonuses for delete
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or (agent_id = auth.uid() and status = 'pending')
  )
);
