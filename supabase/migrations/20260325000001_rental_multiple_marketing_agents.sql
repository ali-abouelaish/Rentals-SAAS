-- Allow multiple marketing agents per rental with equal fee splitting.
-- The total marketing fee is still determined by the primary agent's profile
-- (or an admin override). This table records all agents who share that fee.

-- 1. Create junction table
create table if not exists rental_marketing_agents (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references tenants(id) on delete cascade,
  rental_id  uuid        not null references rental_codes(id) on delete cascade,
  agent_id   uuid        not null references user_profiles(id),
  created_at timestamptz not null default now(),
  unique(rental_id, agent_id)
);

alter table rental_marketing_agents enable row level security;

-- SELECT: any tenant member can read (agents need to see their own entries;
--         the assisted agent needs to see who the marketing agents are)
create policy "rental_marketing_agents select"
on rental_marketing_agents for select
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or agent_id = auth.uid()
    or exists (
      select 1 from rental_codes rc
      where rc.id = rental_id
        and rc.assisted_by_agent_id = auth.uid()
    )
  )
);

-- INSERT: any tenant member can insert (agents create rentals with marketing agents)
create policy "rental_marketing_agents insert"
on rental_marketing_agents for insert
with check (tenant_id = current_tenant_id());

-- DELETE: admin or the rental owner (only while still pending)
create policy "rental_marketing_agents delete"
on rental_marketing_agents for delete
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or exists (
      select 1 from rental_codes rc
      where rc.id = rental_id
        and rc.assisted_by_agent_id = auth.uid()
        and rc.status = 'pending'
    )
  )
);

-- 2. Migrate existing single marketing_agent_id → junction table
insert into rental_marketing_agents (tenant_id, rental_id, agent_id)
select tenant_id, id as rental_id, marketing_agent_id as agent_id
from rental_codes
where marketing_agent_id is not null
on conflict do nothing;

-- 3. Extend rental_codes RLS select policy to also allow junction table members
drop policy if exists "rentals select" on rental_codes;

create policy "rentals select"
on rental_codes for select
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or assisted_by_agent_id = auth.uid()
    or marketing_agent_id = auth.uid()
    or exists (
      select 1 from rental_marketing_agents rma
      where rma.rental_id = id
        and rma.agent_id = auth.uid()
    )
  )
);

-- 4. Update get_earnings_leaderboard to distribute marketing fees via junction table
create or replace function get_earnings_leaderboard(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  agent_id          uuid,
  agent_name        text,
  avatar_url        text,
  transactions_count int,
  agent_earnings    numeric,
  agency_earnings   numeric,
  total_earnings    numeric,
  last_activity     timestamptz,
  commission_percent numeric,
  rank              int
)
language sql
stable
as $$
  with filtered as (
    select *
    from rental_earnings_view
    where tenant_id = p_tenant_id
      and date >= p_from
      and date <= p_to
  ),
  -- pre-compute per-rental agent counts from the junction table
  rma_counts as (
    select
      rental_id,
      count(*)::numeric as cnt
    from rental_marketing_agents
    where tenant_id = p_tenant_id
    group by rental_id
  ),
  per_agent as (
    -- As the assisted agent: earns net commission, contributes rental_net to total
    select
      assisted_by_agent_id as agent_id,
      count(*)::int        as transactions_count,
      sum(rental_net)      as total_rental_net,
      sum(agent_earning)   as earned
    from filtered
    group by assisted_by_agent_id

    union all

    -- As a marketing agent: earns their equal share of the total marketing fee
    select
      rma.agent_id,
      0                                          as transactions_count,
      0                                          as total_rental_net,
      sum(f.marketing_fee / rma_c.cnt)           as earned
    from filtered f
    join rental_marketing_agents rma   on rma.rental_id = f.id
    join rma_counts              rma_c on rma_c.rental_id = f.id
    where rma.agent_id != f.assisted_by_agent_id
    group by rma.agent_id
  ),
  combined as (
    select
      agent_id,
      sum(transactions_count)::int as transactions_count,
      sum(total_rental_net)        as total_earnings,
      sum(earned)                  as agent_earnings
    from per_agent
    group by agent_id
  ),
  last_activity_cte as (
    select actor_user_id as agent_id, max(created_at) as last_activity
    from activity_log
    where tenant_id = p_tenant_id
      and created_at >= p_from
      and created_at <= p_to
    group by actor_user_id
  )
  select
    c.agent_id,
    up.display_name                            as agent_name,
    ap.avatar_url,
    c.transactions_count,
    c.agent_earnings,
    c.total_earnings - c.agent_earnings        as agency_earnings,
    c.total_earnings,
    la.last_activity,
    ap.commission_percent,
    dense_rank() over (order by c.agent_earnings desc)::int as rank
  from combined c
  join user_profiles   up on up.id         = c.agent_id and up.tenant_id = p_tenant_id
  left join agent_profiles ap on ap.user_id = c.agent_id and ap.tenant_id = p_tenant_id
  left join last_activity_cte la on la.agent_id = c.agent_id
  order by c.agent_earnings desc
  limit 10;
$$;
