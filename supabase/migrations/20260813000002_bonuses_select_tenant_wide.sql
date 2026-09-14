-- Let every user in the tenant read every bonus.
--
-- Previously agents could only select their own rows
-- (20260129120013_bonuses_rls_update.sql):
--   using (tenant_id = current_tenant_id() and (is_admin() or agent_id = auth.uid()))
-- so the /bonuses tab showed a non-admin only their own bonuses.
--
-- This widens SELECT to the whole tenant. Agents can now see each other's
-- bonus amounts, clients, landlords and payout status.
--
-- Deliberately SELECT only. Insert, update and delete are untouched, so an
-- agent still cannot create, edit or delete a bonus that is not their own —
-- those policies continue to require is_admin() or (agent_id = auth.uid()
-- and status = 'pending').

drop policy if exists "bonuses select" on bonuses;

create policy "bonuses select"
on bonuses for select
using (tenant_id = current_tenant_id());
