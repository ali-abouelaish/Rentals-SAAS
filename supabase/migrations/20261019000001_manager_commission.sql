-- Manager commission.
--
-- A manager earns a percentage on deals closed by a pool of agents. The
-- percentage is taken on the rental net (after card fee and VAT) and/or the
-- bonus amount, and is paid out of the company's share — the agent's own
-- commission is never reduced. It is not capped: if the manager's cut is more
-- than the company keeps, the company is down on that deal.
--
-- Terms are versioned by date. Changing the %, the scope or the pool closes
-- the current version and opens a new one from a chosen day, so deals dated
-- before it keep the old terms. An agent sits in at most one manager's pool on
-- any given day; adding them to a pool moves them out of their old one.
--
-- "Manager" is a capability, not a user_profiles.role: the role string
-- 'manager' already grants PM maintenance and acquisition-insights access.

create table if not exists public.manager_commission_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  manager_id uuid not null references public.user_profiles(id),
  commission_percent numeric(5,2) not null
    check (commission_percent > 0 and commission_percent <= 100),
  applies_to text not null check (applies_to in ('rentals', 'bonuses', 'both')),
  effective_from date not null,
  -- Inclusive last day. Null = the current version.
  effective_to date,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists manager_commission_plans_one_current
  on public.manager_commission_plans(manager_id)
  where effective_to is null;

create index if not exists idx_manager_commission_plans_tenant_manager
  on public.manager_commission_plans(tenant_id, manager_id, effective_from);

create table if not exists public.manager_commission_pool (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.manager_commission_plans(id) on delete cascade,
  agent_id uuid not null references public.user_profiles(id),
  unique (plan_id, agent_id)
);

create index if not exists idx_manager_commission_pool_agent
  on public.manager_commission_pool(tenant_id, agent_id);

-- One row per manager line marked paid. amount_gbp is the amount at the time
-- it was paid, so later edits to the deal don't rewrite what was handed over.
-- Unpaid = no row.
create table if not exists public.manager_commission_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  manager_id uuid not null references public.user_profiles(id),
  source_type text not null check (source_type in ('rental', 'bonus')),
  source_id uuid not null,
  amount_gbp numeric(12,2) not null check (amount_gbp >= 0),
  paid_at timestamptz not null default now(),
  paid_by uuid references public.user_profiles(id),
  unique (tenant_id, source_type, source_id, manager_id)
);

create index if not exists idx_manager_commission_payments_manager
  on public.manager_commission_payments(tenant_id, manager_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Admins see and manage everything in their tenant; a manager can read their
-- own plans, pool and payments. Agents in a pool can't see who manages them.

alter table public.manager_commission_plans enable row level security;
alter table public.manager_commission_pool enable row level security;
alter table public.manager_commission_payments enable row level security;

drop policy if exists "manager plans select" on public.manager_commission_plans;
drop policy if exists "manager plans modify" on public.manager_commission_plans;
drop policy if exists "manager pool select" on public.manager_commission_pool;
drop policy if exists "manager pool modify" on public.manager_commission_pool;
drop policy if exists "manager payments select" on public.manager_commission_payments;
drop policy if exists "manager payments modify" on public.manager_commission_payments;

create policy "manager plans select"
on public.manager_commission_plans for select
using (
  tenant_id = current_tenant_id()
  and (is_admin() or manager_id = (select auth.uid()))
);

create policy "manager plans modify"
on public.manager_commission_plans for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

create policy "manager pool select"
on public.manager_commission_pool for select
using (
  tenant_id = current_tenant_id()
  and (
    is_admin()
    or exists (
      select 1 from public.manager_commission_plans p
      where p.id = plan_id and p.manager_id = (select auth.uid())
    )
  )
);

create policy "manager pool modify"
on public.manager_commission_pool for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

create policy "manager payments select"
on public.manager_commission_payments for select
using (
  tenant_id = current_tenant_id()
  and (is_admin() or manager_id = (select auth.uid()))
);

create policy "manager payments modify"
on public.manager_commission_payments for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

-- ── save_manager_commission_plan ───────────────────────────────────────────
-- Creates or changes a manager's terms from p_effective_from, atomically:
--   * same day as the current version  -> edit that version in place
--   * later than the current version   -> close it the day before, open a new one
--   * earlier                          -> refused (history can't be rewritten)
-- Agents taken from another manager's current pool get the same treatment on
-- that manager's side. A final check refuses any overlap left behind.
-- security invoker: RLS still applies, so only tenant admins get through.

create or replace function public.save_manager_commission_plan(
  p_manager_id uuid,
  p_percent numeric,
  p_applies_to text,
  p_agent_ids uuid[],
  p_effective_from date
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

  insert into public.manager_commission_pool (tenant_id, plan_id, agent_id)
  select v_tenant, v_plan_id, a from unnest(v_agents) as a;

  -- 2. Move the picked agents out of any other manager's current pool.
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

      insert into public.manager_commission_pool (tenant_id, plan_id, agent_id)
      select v_tenant, v_new_other, mp.agent_id
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

-- ── end_manager_commission_plan ────────────────────────────────────────────
-- Stops a manager earning after p_end_date (inclusive). A version that hadn't
-- started by then never took effect, so it is removed outright.

create or replace function public.end_manager_commission_plan(
  p_manager_id uuid,
  p_end_date date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenant uuid := current_tenant_id();
  v_current public.manager_commission_plans%rowtype;
begin
  if v_tenant is null or not is_admin() then
    raise exception 'Only agency admins can change manager commission.'
      using errcode = '42501';
  end if;
  if p_end_date is null then
    raise exception 'Choose the last day this manager earns commission.';
  end if;

  select * into v_current
    from public.manager_commission_plans
   where tenant_id = v_tenant and manager_id = p_manager_id and effective_to is null
   for update;

  if not found then
    raise exception 'This user isn''t currently a manager.';
  end if;

  if p_end_date < v_current.effective_from then
    delete from public.manager_commission_plans where id = v_current.id;
  else
    update public.manager_commission_plans
       set effective_to = p_end_date
     where id = v_current.id;
  end if;
end;
$$;

grant execute on function public.save_manager_commission_plan(uuid, numeric, text, uuid[], date) to authenticated;
grant execute on function public.end_manager_commission_plan(uuid, date) to authenticated;
