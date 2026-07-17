-- ============================================================
-- Staff comments on maintenance tickets and jobs.
-- ============================================================
-- Two tables (not the polymorphic maintenance_attachments
-- pattern) so PostgREST FK embedding and cascade deletes work.
--
-- Visibility model:
--   * Ticket comments are shown to the renter in the /support
--     "Your open requests" list (served via the admin client,
--     scoped by tenant_id + pm_tenant_id, same as tickets).
--   * Job comments are internal staff notes only.
--
-- author_name is denormalised from user_profiles.display_name
-- so comments keep their byline if the author is deleted.
-- ============================================================

-- ─── maintenance_ticket_comments ───────────────────────────
create table public.maintenance_ticket_comments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  ticket_id      uuid not null references public.maintenance_tickets(id) on delete cascade,
  author_user_id uuid references public.user_profiles(id) on delete set null,
  author_name    text not null,
  body           text not null,
  created_at     timestamptz not null default now()
);

create index on public.maintenance_ticket_comments (tenant_id, ticket_id, created_at);

-- ─── maintenance_job_comments ──────────────────────────────
create table public.maintenance_job_comments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  job_id         uuid not null references public.maintenance_jobs(id) on delete cascade,
  author_user_id uuid references public.user_profiles(id) on delete set null,
  author_name    text not null,
  body           text not null,
  created_at     timestamptz not null default now()
);

create index on public.maintenance_job_comments (tenant_id, job_id, created_at);

-- ─── RLS ───────────────────────────────────────────────────
alter table public.maintenance_ticket_comments enable row level security;
alter table public.maintenance_job_comments    enable row level security;

create policy "tenant_members_select_maintenance_ticket_comments"
  on public.maintenance_ticket_comments for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_ticket_comments"
  on public.maintenance_ticket_comments for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

create policy "tenant_members_select_maintenance_job_comments"
  on public.maintenance_job_comments for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_job_comments"
  on public.maintenance_job_comments for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());
