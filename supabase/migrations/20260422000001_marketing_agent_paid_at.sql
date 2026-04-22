-- Two-sided paid status for rentals.
-- The existing `rental_codes.status='paid'` flag now only represents the
-- payout to the assisted agent. Each marketing agent has an independent
-- `paid_at` on the junction row, starting NULL (unpaid) for all historical
-- rentals regardless of the rental's current status.

-- 1. Add paid_at column to the junction table
alter table rental_marketing_agents
  add column if not exists paid_at timestamptz;

-- 2. Safety-net backfill: ensure every rental that has a non-null
--    `marketing_agent_id` also has a matching junction row. The original
--    migration (20260325000001) performed this backfill, but any rentals
--    inserted afterwards through code paths that only set marketing_agent_id
--    would still be missing a junction row.
insert into rental_marketing_agents (tenant_id, rental_id, agent_id)
select rc.tenant_id, rc.id, rc.marketing_agent_id
from rental_codes rc
where rc.marketing_agent_id is not null
  and not exists (
    select 1 from rental_marketing_agents rma
    where rma.rental_id = rc.id
      and rma.agent_id = rc.marketing_agent_id
  )
on conflict do nothing;

-- paid_at is left NULL for every existing row (option A — the admin must
-- explicitly mark each marketing payout as paid). No further backfill.

-- 3. Allow admins to update paid_at
create policy "rental_marketing_agents update"
on rental_marketing_agents for update
using (
  tenant_id = current_tenant_id()
  and is_admin()
)
with check (
  tenant_id = current_tenant_id()
  and is_admin()
);

-- 4. Helpful index for lookups by (rental_id, agent_id) — already covered by
--    the unique constraint on (rental_id, agent_id) created in the original
--    migration, so no new index needed.
