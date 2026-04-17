-- AI Maintenance Triage v1
-- Tenant-facing triage chatbot + ticket submission.
-- Conversations and tickets are distinct from internal maintenance_jobs.
--
-- Name mapping vs. external spec:
--   companies  → tenants            (SaaS tenant = Harbor Ops company)
--   rooms      → units              (unit_type ∈ room/studio/whole_flat)
--   tenants    → pm_tenants         (property management tenants, end-users)
-- Priority mapping: p0_emergency→critical, urgent→high, normal→medium, minor→low
-- Status: reuse maintenance_job_status, extended with acknowledged + cancelled.

-- ============================================================
-- 1. Extend existing enum: add acknowledged, cancelled
-- ============================================================
alter type maintenance_job_status add value if not exists 'acknowledged' before 'in_progress';
alter type maintenance_job_status add value if not exists 'cancelled';

-- ============================================================
-- 2. AI context notes on properties and units
-- ============================================================
alter table public.properties add column if not exists notes text;
alter table public.units      add column if not exists notes text;

-- ============================================================
-- 3. Per-tenant landlord alert email (for P0 notifications)
-- ============================================================
alter table public.tenants add column if not exists alert_email text;

-- ============================================================
-- 4. maintenance_conversations
-- ============================================================
create table public.maintenance_conversations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  unit_id        uuid not null references public.units(id) on delete cascade,
  pm_tenant_id   uuid not null references public.pm_tenants(id) on delete cascade,
  status         text not null default 'active'
                   check (status in ('active','self_resolved','ticket_created','abandoned','emergency')),
  emergency_type text check (emergency_type in ('gas','fire','water','electric','lockout','no_heat_cold')),
  turn_count     int not null default 0,
  started_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create index on public.maintenance_conversations (tenant_id, status);
create index on public.maintenance_conversations (pm_tenant_id, started_at desc);

-- ============================================================
-- 5. maintenance_messages
-- ============================================================
create table public.maintenance_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.maintenance_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index on public.maintenance_messages (conversation_id, created_at);

-- ============================================================
-- 6. maintenance_tickets
-- Separate from maintenance_jobs — this is the tenant-submitted ticket.
-- Staff may later promote a ticket into a maintenance_job for costing.
-- ============================================================
create table public.maintenance_tickets (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  property_id        uuid not null references public.properties(id) on delete cascade,
  unit_id            uuid not null references public.units(id) on delete cascade,
  pm_tenant_id       uuid not null references public.pm_tenants(id) on delete cascade,
  conversation_id    uuid references public.maintenance_conversations(id) on delete set null,
  reference          text not null,
  description        text not null,
  priority           maintenance_job_priority not null default 'medium',
  status             maintenance_job_status not null default 'open',
  seen_by_landlord   boolean not null default false,
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  unique (tenant_id, reference)
);

create index on public.maintenance_tickets (tenant_id, status, seen_by_landlord);
create index on public.maintenance_tickets (tenant_id, priority, created_at desc);
create index on public.maintenance_tickets (pm_tenant_id, status);

-- ============================================================
-- 7. maintenance_attachments
-- Polymorphic: parent is either a conversation or a ticket.
-- parent_id has no FK because it points at one of two tables; integrity
-- enforced in app code (uploads go to conversation first, then reassigned
-- when the ticket is created).
-- ============================================================
create table public.maintenance_attachments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  parent_id    uuid not null,
  parent_type  text not null check (parent_type in ('conversation','ticket')),
  kind         text not null check (kind in ('image','video','audio')),
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create index on public.maintenance_attachments (parent_id, parent_type);
create index on public.maintenance_attachments (tenant_id, created_at desc);

-- ============================================================
-- 8. Row Level Security
-- Public /api/support/* routes use the admin client (bypasses RLS) and
-- scope by tenant_id manually. These policies govern staff-side access
-- through the Maintenance tab.
-- ============================================================

alter table public.maintenance_conversations enable row level security;
alter table public.maintenance_messages      enable row level security;
alter table public.maintenance_tickets       enable row level security;
alter table public.maintenance_attachments   enable row level security;

-- maintenance_conversations
create policy "tenant_members_select_maintenance_conversations"
  on public.maintenance_conversations for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_conversations"
  on public.maintenance_conversations for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- maintenance_messages (scoped through the parent conversation)
create policy "tenant_members_select_maintenance_messages"
  on public.maintenance_messages for select
  using (
    exists (
      select 1 from public.maintenance_conversations c
      where c.id = maintenance_messages.conversation_id
        and c.tenant_id = (select current_tenant_id())
    )
  );

create policy "admins_all_maintenance_messages"
  on public.maintenance_messages for all
  using (
    is_admin() and exists (
      select 1 from public.maintenance_conversations c
      where c.id = maintenance_messages.conversation_id
        and c.tenant_id = (select current_tenant_id())
    )
  )
  with check (
    is_admin() and exists (
      select 1 from public.maintenance_conversations c
      where c.id = maintenance_messages.conversation_id
        and c.tenant_id = (select current_tenant_id())
    )
  );

-- maintenance_tickets
create policy "tenant_members_select_maintenance_tickets"
  on public.maintenance_tickets for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_tickets"
  on public.maintenance_tickets for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- maintenance_attachments
create policy "tenant_members_select_maintenance_attachments"
  on public.maintenance_attachments for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_maintenance_attachments"
  on public.maintenance_attachments for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ============================================================
-- 9. Storage bucket: maintenance-media (private)
-- Served to staff via signed URLs (1h expiry) from the admin client.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('maintenance-media', 'maintenance-media', false)
on conflict (id) do nothing;
