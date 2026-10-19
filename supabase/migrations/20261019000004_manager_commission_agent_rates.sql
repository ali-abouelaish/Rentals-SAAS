-- Manager commission: optional percentage per agent.
--
-- A manager has a default percentage (manager_commission_plans.commission_percent).
-- Any agent in the pool can be given their own rate instead; null = use the
-- manager's default. Per-agent rates live on the pool row, so they are dated
-- with the plan version like everything else — changing one starts a new
-- version and earlier deals keep the old rate.

alter table public.manager_commission_pool
  add column if not exists commission_percent numeric(5,2)
    check (commission_percent is null or (commission_percent > 0 and commission_percent <= 100));

-- Replaces the 5-argument version from 20261019000001 with one that also
-- takes per-agent rates: p_agent_percents is a JSON object of
-- { "<agent uuid>": <percent> }. Agents not in it use p_percent.
drop function if exists public.save_manager_commission_plan(uuid, numeric, text, uuid[], date);

create or replace function public.save_manager_commission_plan(
  p_manager_id uuid,
  p_percent numeric,
  p_applies_to text,
  p_agent_ids uuid[],
  p_effective_from date,
  p_agent_percents jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_actor uuid := auth.uid();
  v_agents uuid[];
  v_rates jsonb := coalesce(p_agent_percents, '{}'::jsonb);
  v_current public.manager_commission_plans%rowtype;
  v_plan_id uuid;
  v_other public.manager_commission_plans%rowtype;
  v_new_other uuid;
  v_conflict_name text;
begin
  if v_tenant is null or not is_admin() then
    raise exception 'Only agency admins can change manager commission.'
      using errcode = '42501';
  end if;

  if p_percent is null or p_percent <= 0 or p_percent > 100 then
    raise exception 'The manager percentage must be more than 0 and no more than 100.';
  end if;
  if p_applies_to is null or p_applies_to not in ('rentals', 'bonuses', 'both') then
    raise exception 'Choose whether the percentage applies to rentals, bonuses or both.';
  end if;
  if p_effective_from is null then
    raise exception 'Choose the date these settings start from.';
  end if;
  if jsonb_typeof(v_rates) <> 'object' then
    raise exception 'Per-agent percentages are in the wrong format.';
  end if;
  if exists (
    select 1 from jsonb_each_text(v_rates) as e
     where e.value is not null and e.value <> ''
       and (e.value::numeric <= 0 or e.value::numeric > 100)
  ) then
    raise exception 'Each agent''s percentage must be more than 0 and no more than 100.';
  end if;

  select coalesce(array_agg(distinct a), '{}')
    into v_agents
    from unnest(coalesce(p_agent_ids, '{}')) as a
   where a is not null;

  if cardinality(v_agents) = 0 then
    raise exception 'Pick at least one agent for the pool.';
  end if;
  if p_manager_id = any(v_agents) then
    raise exception 'A manager can''t be in their own pool.';
  end if;

  if not exists (
    select 1 from public.user_profiles
     where id = p_manager_id and tenant_id = v_tenant
  ) then
    raise exception 'That manager isn''t in this agency.';
  end if;
  if (
    select count(*) from public.user_profiles
     where id = any(v_agents) and tenant_id = v_tenant
  ) <> cardinality(v_agents) then
    raise exception 'One or more of the agents picked aren''t in this agency.';
  end if;

  -- 1. This manager's own current version.
  select * into v_current
    from public.manager_commission_plans
   where tenant_id = v_tenant and manager_id = p_manager_id and effective_to is null
   for update;

  if found then
    if p_effective_from < v_current.effective_from then
      raise exception 'The start date can''t be before the current settings started (%).',
        to_char(v_current.effective_from, 'DD/MM/YYYY');
    elsif p_effective_from = v_current.effective_from then
      update public.manager_commission_plans
         set commission_percent = p_percent, applies_to = p_applies_to
       where id = v_current.id;
      delete from public.manager_commission_pool where plan_id = v_current.id;
      v_plan_id := v_current.id;
    else
      update public.manager_commission_plans
         set effective_to = p_effective_from - 1
       where id = v_current.id;
    end if;
  end if;

  if v_plan_id is null then
    insert into public.manager_commission_plans
      (tenant_id, manager_id, commission_percent, applies_to, effective_from, created_by)
    values
      (v_tenant, p_manager_id, p_percent, p_applies_to, p_effective_from, v_actor)
    returning id into v_plan_id;
  end if;

  insert into public.manager_commission_pool (tenant_id, plan_id, agent_id, commission_percent)
  select v_tenant, v_plan_id, a, nullif(v_rates ->> a::text, '')::numeric
    from unnest(v_agents) as a;

  -- 2. Move the picked agents out of any other manager's current pool. The
  --    agents left behind keep their own rates in the new version.
  for v_other in
    select p.*
      from public.manager_commission_plans p
     where p.tenant_id = v_tenant
       and p.effective_to is null
       and p.manager_id <> p_manager_id
       and exists (
         select 1 from public.manager_commission_pool mp
          where mp.plan_id = p.id and mp.agent_id = any(v_agents)
       )
     for update
  loop
    if p_effective_from < v_other.effective_from then
      raise exception 'An agent you picked joined another manager''s pool on %. Use that date or later.',
        to_char(v_other.effective_from, 'DD/MM/YYYY');
    elsif p_effective_from = v_other.effective_from then
      delete from public.manager_commission_pool
       where plan_id = v_other.id and agent_id = any(v_agents);
    else
      update public.manager_commission_plans
         set effective_to = p_effective_from - 1
       where id = v_other.id;

      insert into public.manager_commission_plans
        (tenant_id, manager_id, commission_percent, applies_to, effective_from, created_by)
      values
        (v_tenant, v_other.manager_id, v_other.commission_percent, v_other.applies_to,
         p_effective_from, v_actor)
      returning id into v_new_other;

      insert into public.manager_commission_pool (tenant_id, plan_id, agent_id, commission_percent)
      select v_tenant, v_new_other, mp.agent_id, mp.commission_percent
        from public.manager_commission_pool mp
       where mp.plan_id = v_other.id
         and not (mp.agent_id = any(v_agents));
    end if;
  end loop;

  -- 3. Safety net: no manager has two versions covering the same day…
  if exists (
    select 1
      from public.manager_commission_plans a
      join public.manager_commission_plans b
        on b.manager_id = a.manager_id and b.id <> a.id
     where a.tenant_id = v_tenant
       and a.manager_id = p_manager_id
       and daterange(a.effective_from, a.effective_to, '[]')
           && daterange(b.effective_from, b.effective_to, '[]')
  ) then
    raise exception 'These dates overlap this manager''s earlier settings. Pick a later start date.';
  end if;

  -- …and no agent is in two pools on the same day.
  select up.display_name into v_conflict_name
    from public.manager_commission_pool a
    join public.manager_commission_plans pa on pa.id = a.plan_id
    join public.manager_commission_pool b
      on b.agent_id = a.agent_id and b.plan_id <> a.plan_id
    join public.manager_commission_plans pb on pb.id = b.plan_id
    left join public.user_profiles up on up.id = a.agent_id
   where a.tenant_id = v_tenant
     and a.agent_id = any(v_agents)
     and daterange(pa.effective_from, pa.effective_to, '[]')
         && daterange(pb.effective_from, pb.effective_to, '[]')
   limit 1;

  if found then
    raise exception '% would be in two managers'' pools at the same time. Pick a later start date.',
      coalesce(v_conflict_name, 'An agent');
  end if;

  return v_plan_id;
end;
$$;

grant execute on function public.save_manager_commission_plan(uuid, numeric, text, uuid[], date, jsonb) to authenticated;
