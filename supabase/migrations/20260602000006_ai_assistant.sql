-- AI Assistant (Property Management module)
-- Admin-only, read-only natural-language assistant over the tenant's PM data.
-- The assistant itself answers questions via a curated set of read-only tools
-- that wrap existing tenant-scoped data functions (RLS does the isolation).
-- These tables only persist the chat transcript so a conversation can continue.
--
-- Name mapping reminder (same as maintenance triage):
--   tenants     = the SaaS agency/company (NOT an occupant)
--   pm_tenants  = the people renting (occupants)
--   units       = rooms (unit_type ∈ room/studio/whole_flat)

-- ============================================================
-- 1. Entitlement seed
-- getEntitlements() defaults every non-admin feature to enabled; this row keeps
-- the feature visible in the super-admin toggle view and lets it be disabled per
-- tenant. Matches the finances/contract_templates seeding convention.
-- ============================================================
insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'ai_assistant'
from public.tenants
on conflict do nothing;

-- ============================================================
-- 2. assistant_conversations
-- ============================================================
create table public.assistant_conversations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  created_by  uuid references public.user_profiles(id) on delete set null,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.assistant_conversations (tenant_id, created_by, updated_at desc);

-- ============================================================
-- 3. assistant_messages
-- ============================================================
create table public.assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index on public.assistant_messages (conversation_id, created_at);

-- ============================================================
-- 4. Row Level Security — admin-only, tenant-scoped.
-- Persistence goes through the authenticated server client (RLS), unlike the
-- public /support chat which uses the admin client. is_admin() and
-- current_tenant_id() are the existing helpers used by every PM policy.
-- ============================================================
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages      enable row level security;

create policy "admins_all_assistant_conversations"
  on public.assistant_conversations for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

create policy "admins_all_assistant_messages"
  on public.assistant_messages for all
  using (
    is_admin() and exists (
      select 1 from public.assistant_conversations c
      where c.id = assistant_messages.conversation_id
        and c.tenant_id = (select current_tenant_id())
    )
  )
  with check (
    tenant_id = (select current_tenant_id())
    and is_admin()
    and exists (
      select 1 from public.assistant_conversations c
      where c.id = assistant_messages.conversation_id
        and c.tenant_id = (select current_tenant_id())
    )
  );
