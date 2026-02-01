-- Earnings analytics RPCs
-- Recommended indexes:
-- ledger_entries(tenant_id, created_at)
-- ledger_entries(agent_id, created_at)
-- activity_log(tenant_id, actor_user_id, created_at)

create or replace function get_earnings_leaderboard(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  agent_id uuid,
  agent_name text,
  avatar_url text,
  transactions_count int,
  agent_earnings numeric,
  agency_earnings numeric,
  total_earnings numeric,
  last_activity timestamptz,
  commission_percent numeric,
  rank int
)
language sql
stable
as $$
  with rental_net as (
    select le.reference_id as rental_id, le.amount_gbp
    from ledger_entries le
    where le.tenant_id = p_tenant_id
      and le.created_at >= p_from
      and le.created_at <= p_to
      and le.type = 'rental_net'
  ),
  rental_agents as (
    select rn.rental_id, rn.amount_gbp, rc.assisted_by_agent_id as agent_id
    from rental_net rn
    join rental_codes rc on rc.id = rn.rental_id
  ),
  agent_earnings as (
    select agent_id,
      sum(coalesce(agent_earning_gbp, 0)) as agent_earnings
    from ledger_entries
    where tenant_id = p_tenant_id
      and created_at >= p_from
      and created_at <= p_to
      and type in ('agent_earning', 'marketing_fee')
      and agent_id is not null
    group by agent_id
  ),
  aggregated as (
    select
      rental_agents.agent_id,
      count(*) filter (where rental_agents.amount_gbp > 0) as transactions_count,
      sum(coalesce(rental_agents.amount_gbp, 0)) as total_earnings
    from rental_agents
    group by rental_agents.agent_id
  ),
  last_activity as (
    select actor_user_id as agent_id, max(created_at) as last_activity
    from activity_log
    where tenant_id = p_tenant_id
      and created_at >= p_from
      and created_at <= p_to
    group by actor_user_id
  )
  select
    aggregated.agent_id,
    user_profiles.display_name as agent_name,
    agent_profiles.avatar_url,
    aggregated.transactions_count,
    coalesce(agent_earnings.agent_earnings, 0) as agent_earnings,
    coalesce(aggregated.total_earnings, 0) - coalesce(agent_earnings.agent_earnings, 0) as agency_earnings,
    coalesce(aggregated.total_earnings, 0) as total_earnings,
    last_activity.last_activity,
    agent_profiles.commission_percent,
    dense_rank() over (order by coalesce(agent_earnings.agent_earnings, 0) desc) as rank
  from aggregated
  join user_profiles on user_profiles.id = aggregated.agent_id
  left join agent_profiles on agent_profiles.user_id = aggregated.agent_id
  left join last_activity on last_activity.agent_id = aggregated.agent_id
  left join agent_earnings on agent_earnings.agent_id = aggregated.agent_id
  where user_profiles.tenant_id = p_tenant_id
  order by coalesce(agent_earnings.agent_earnings, 0) desc
  limit 10;
$$;

create or replace function get_earnings_trend(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text
)
returns table (
  bucket_date date,
  total_earnings numeric,
  agent_earnings numeric
)
language sql
stable
as $$
  select
    (date_trunc(p_bucket, created_at))::date as bucket_date,
    sum(case when type = 'rental_net' then coalesce(amount_gbp, 0) else 0 end) as total_earnings,
    sum(case when type in ('agent_earning', 'marketing_fee') then coalesce(agent_earning_gbp, 0) else 0 end) as agent_earnings
  from ledger_entries
  where tenant_id = p_tenant_id
    and created_at >= p_from
    and created_at <= p_to
  group by bucket_date
  order by bucket_date;
$$;

create or replace function next_invoice_number(p_tenant_id uuid)
returns text
language plpgsql
as $$
declare
  next_value integer;
begin
  insert into tenant_invoice_counter(tenant_id, current_value)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update
  set current_value = tenant_invoice_counter.current_value + 1
  returning current_value into next_value;

  return 'INV-' || lpad(next_value::text, 6, '0');
end;
$$;
