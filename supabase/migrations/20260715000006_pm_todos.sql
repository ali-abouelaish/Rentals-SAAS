-- ============================================================
-- Property-management dashboard to-do list.
-- ============================================================
-- A lightweight task list surfaced on the PM dashboard. Each
-- todo is either:
--   * personal — visible only to the person who created it, or
--   * team     — visible to (and completable/deletable by) every
--                member of the same tenant.
--
-- creator_name is denormalised from user_profiles.display_name so
-- team todos keep their "added by" byline even if the author is
-- later removed. property_id is optional and simply links a task
-- to a property for context.
-- ============================================================

create table public.pm_todos (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  created_by   uuid references public.user_profiles(id) on delete set null,
  creator_name text not null,
  title        text not null,
  due_date     date,
  property_id  uuid references public.properties(id) on delete set null,
  visibility   text not null default 'personal' check (visibility in ('personal', 'team')),
  is_done      boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Open tasks, soonest due first, is the default dashboard ordering.
create index on public.pm_todos (tenant_id, is_done, due_date);
create index on public.pm_todos (tenant_id, created_by);

-- ─── RLS ───────────────────────────────────────────────────
alter table public.pm_todos enable row level security;

-- A member may read team todos across their tenant, plus their own
-- personal todos.
create policy "pm_todos_select"
  on public.pm_todos for select
  using (
    tenant_id = (select current_tenant_id())
    and (visibility = 'team' or created_by = (select auth.uid()))
  );

-- A member may only create todos authored by themselves in their tenant.
create policy "pm_todos_insert"
  on public.pm_todos for insert
  with check (
    tenant_id = (select current_tenant_id())
    and created_by = (select auth.uid())
  );

-- A member may update/delete team todos or their own personal todos.
create policy "pm_todos_update"
  on public.pm_todos for update
  using (
    tenant_id = (select current_tenant_id())
    and (visibility = 'team' or created_by = (select auth.uid()))
  )
  with check (
    tenant_id = (select current_tenant_id())
    and (visibility = 'team' or created_by = (select auth.uid()))
  );

create policy "pm_todos_delete"
  on public.pm_todos for delete
  using (
    tenant_id = (select current_tenant_id())
    and (visibility = 'team' or created_by = (select auth.uid()))
  );
