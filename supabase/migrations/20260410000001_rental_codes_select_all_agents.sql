-- Allow all authenticated tenant users to see all rentals within their tenant.
-- Replaces the old policy that had per-agent checks with an exists subquery
-- into rental_marketing_agents, which could cause performance issues or
-- fail to resolve correctly for marketing agents.
drop policy if exists "rentals select" on rental_codes;

create policy "rentals select"
on rental_codes for select
using (
  tenant_id = current_tenant_id()
);
