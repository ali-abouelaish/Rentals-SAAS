-- Replace ledger-based earnings computation with a live view over rental_codes.
-- The ledger entries for rental_net / agent_earning / marketing_fee are no longer
-- written; all earnings figures are derived on the fly from source data.

-- Step 1: snapshot the agent's commission % onto rental_codes at approval time.
-- Existing rows will have NULL here; those fall back to the current agent_profiles value.
alter table rental_codes
  add column if not exists commission_percent_at_approval numeric;

-- Ensure columns exist (may be missing on older production DBs where
-- CREATE TABLE IF NOT EXISTS skipped additions from a later schema version).
alter table rental_codes add column if not exists marketing_fee_override_gbp numeric(12,2);
alter table rental_codes add column if not exists marketing_fee_override_reason text;

-- Step 2: live view that computes rental earnings from rental_codes + agent_profiles.
-- Uses security_invoker so the caller's RLS context applies to the underlying tables.
create or replace view rental_earnings_view
  with (security_invoker = true)
as
select
  rc.id,
  rc.tenant_id,
  rc.assisted_by_agent_id,
  rc.marketing_agent_id,
  rc.date,
  rc.consultation_fee_amount,
  rc.payment_method,
  rc.status,
  coalesce(rc.commission_percent_at_approval, ap.commission_percent, 0) as commission_percent,
  -- rental_net: consultation fee minus payment processing cost
  round(
    rc.consultation_fee_amount
    * (1 - case rc.payment_method
        when 'cash'     then 0::numeric
        when 'transfer' then 0.2::numeric
        when 'card'     then 0.0175::numeric
        else 0::numeric
      end)
  , 2) as rental_net,
  -- marketing_fee: override takes precedence, else the marketing agent's standard rate
  coalesce(
    rc.marketing_fee_override_gbp,
    case
      when rc.marketing_agent_id is not null
        and rc.marketing_agent_id != rc.assisted_by_agent_id
      then coalesce(ap_mkt.marketing_fee, 0)
      else 0
    end
  ) as marketing_fee,
  -- agent_earning: commission on rental_net minus marketing fee (assisted agent's net)
  round(
    round(
      rc.consultation_fee_amount
      * (1 - case rc.payment_method
          when 'cash'     then 0::numeric
          when 'transfer' then 0.2::numeric
          when 'card'     then 0.0175::numeric
          else 0::numeric
        end)
    , 2)
    * coalesce(rc.commission_percent_at_approval, ap.commission_percent, 0) / 100
    - coalesce(
        rc.marketing_fee_override_gbp,
        case
          when rc.marketing_agent_id is not null
            and rc.marketing_agent_id != rc.assisted_by_agent_id
          then coalesce(ap_mkt.marketing_fee, 0)
          else 0
        end
      )
  , 2) as agent_earning
from rental_codes rc
join agent_profiles ap on ap.user_id = rc.assisted_by_agent_id
left join agent_profiles ap_mkt on ap_mkt.user_id = rc.marketing_agent_id
where rc.status in ('approved', 'paid');

-- Step 3: rewrite get_earnings_leaderboard to use rental_earnings_view.
-- Aggregates both assisted-agent earnings (net commission) and marketing-agent
-- earnings (marketing fee) into a single row per agent.
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
  with filtered as (
    select *
    from rental_earnings_view
    where tenant_id = p_tenant_id
      and date >= p_from
      and date <= p_to
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

    -- As the marketing agent: earns marketing fee only (no transaction count)
    select
      marketing_agent_id as agent_id,
      0                  as transactions_count,
      0                  as total_rental_net,
      sum(marketing_fee) as earned
    from filtered
    where marketing_agent_id is not null
      and marketing_agent_id != assisted_by_agent_id
    group by marketing_agent_id
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
  join user_profiles  up on up.id         = c.agent_id and up.tenant_id = p_tenant_id
  left join agent_profiles ap on ap.user_id = c.agent_id and ap.tenant_id = p_tenant_id
  left join last_activity_cte la on la.agent_id = c.agent_id
  order by c.agent_earnings desc
  limit 10;
$$;

-- Step 4: rewrite get_earnings_trend to use rental_earnings_view.
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
    date_trunc(p_bucket, date)::date as bucket_date,
    sum(rental_net)                  as total_earnings,
    -- total agent payout = assisted agent's net + marketing agent's fee
    sum(agent_earning + marketing_fee) as agent_earnings
  from rental_earnings_view
  where tenant_id = p_tenant_id
    and date >= p_from
    and date <= p_to
  group by bucket_date
  order by bucket_date;
$$;
