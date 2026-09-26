-- ============================================================
-- Platform support tickets (agency → Harbor Ops)
-- ============================================================
--
-- NOT the renter maintenance triage. `maintenance_tickets` / the public
-- /support chat are renter → agency. These tables are agency → platform: any
-- agency user raises a ticket from /helpdesk, super admins triage it at
-- /admin/support.
--
-- Access model:
--   * Agency users read and write through the RLS-scoped client. Each user sees
--     ONLY the tickets they raised (created_by = auth.uid()).
--   * Every platform-side write (replies, internal notes, status) goes through
--     the service role behind requireSuperAdmin(). There is deliberately no
--     policy for it: is_admin() is true for super_admin AND agency admins, so
--     "super admin only" cannot be expressed in RLS.
--   * Internal notes (is_internal = true) are hidden from agencies BY RLS, on
--     messages and on any attachment linked to one — never merely by the shape
--     of a query.
--
-- Author names are denormalised on purpose, not for convenience: user_profiles
-- SELECT is scoped to current_tenant_id(), so an agency cannot read the row of
-- the super admin who replied. A join would render blank.

-- 1. Tickets --------------------------------------------------

create table if not exists public.platform_support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reference text not null,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_by_name text not null,
  created_by_email text not null,
  subject text not null,
  body text not null,
  category text not null
    check (category in ('bug', 'billing', 'feature_request', 'how_to', 'data_issue', 'other')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_on_agency', 'resolved', 'closed')),
  -- Captured silently at submit time to help us reproduce the problem.
  page_url text,
  user_agent text,
  app_version text,
  last_message_at timestamptz not null default now(),
  agency_last_seen_at timestamptz,
  platform_last_seen_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_support_tickets_reference_key
  on public.platform_support_tickets (reference);
create index if not exists idx_platform_support_tickets_owner
  on public.platform_support_tickets (tenant_id, created_by, last_message_at desc);
create index if not exists idx_platform_support_tickets_queue
  on public.platform_support_tickets (status, last_message_at desc);

drop trigger if exists platform_support_tickets_touch_updated_at on public.platform_support_tickets;
create trigger platform_support_tickets_touch_updated_at
  before update on public.platform_support_tickets
  for each row execute function public.set_updated_at();

comment on table public.platform_support_tickets is
  'Agency → Harbor Ops support tickets. tenant_id is the agency that raised it. Platform writes go through the service role only.';

-- 2. Messages (the two-way thread + internal notes) -----------

create table if not exists public.platform_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.platform_support_tickets(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  author_user_id uuid references public.user_profiles(id) on delete set null,
  author_name text not null,
  author_side text not null check (author_side in ('agency', 'platform')),
  is_internal boolean not null default false,
  body text not null,
  created_at timestamptz not null default now(),
  -- Only the platform can write internal notes.
  constraint platform_support_messages_internal_is_platform
    check (not is_internal or author_side = 'platform')
);

create index if not exists idx_platform_support_messages_ticket
  on public.platform_support_messages (ticket_id, created_at);

-- 3. Attachments ------------------------------------------------

create table if not exists public.platform_support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.platform_support_tickets(id) on delete cascade,
  message_id uuid references public.platform_support_messages(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  -- '<tenant_id>/tickets/<ticket_id>/<uuid>.<ext>' — tenant id FIRST, matching
  -- every other bucket's first-segment authorisation convention.
  storage_path text not null,
  uploaded_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_support_attachments_ticket
  on public.platform_support_attachments (ticket_id, created_at);

-- 4. RLS --------------------------------------------------------

alter table public.platform_support_tickets enable row level security;
alter table public.platform_support_messages enable row level security;
alter table public.platform_support_attachments enable row level security;

drop policy if exists "platform_support_tickets_select" on public.platform_support_tickets;
create policy "platform_support_tickets_select"
  on public.platform_support_tickets for select
  using (
    tenant_id = (select current_tenant_id())
    and created_by = (select auth.uid())
  );

drop policy if exists "platform_support_tickets_insert" on public.platform_support_tickets;
create policy "platform_support_tickets_insert"
  on public.platform_support_tickets for insert
  with check (
    tenant_id = (select current_tenant_id())
    and created_by = (select auth.uid())
    and status = 'open'
  );
-- No UPDATE / DELETE policy: status and seen-markers are changed by the
-- platform (service role) or by the trigger below.

drop policy if exists "platform_support_messages_select" on public.platform_support_messages;
create policy "platform_support_messages_select"
  on public.platform_support_messages for select
  using (
    is_internal = false
    and exists (
      select 1 from public.platform_support_tickets t
      where t.id = ticket_id
        and t.tenant_id = (select current_tenant_id())
        and t.created_by = (select auth.uid())
    )
  );

drop policy if exists "platform_support_messages_insert" on public.platform_support_messages;
create policy "platform_support_messages_insert"
  on public.platform_support_messages for insert
  with check (
    author_side = 'agency'
    and is_internal = false
    and author_user_id = (select auth.uid())
    and tenant_id = (select current_tenant_id())
    and exists (
      select 1 from public.platform_support_tickets t
      where t.id = ticket_id
        and t.tenant_id = (select current_tenant_id())
        and t.created_by = (select auth.uid())
    )
  );

-- Attachments must check the LINKED MESSAGE too, not just ticket ownership.
-- Otherwise a file on an internal note leaks its name, size and storage path.
drop policy if exists "platform_support_attachments_select" on public.platform_support_attachments;
create policy "platform_support_attachments_select"
  on public.platform_support_attachments for select
  using (
    exists (
      select 1 from public.platform_support_tickets t
      where t.id = ticket_id
        and t.tenant_id = (select current_tenant_id())
        and t.created_by = (select auth.uid())
    )
    and (
      message_id is null
      or exists (
        select 1 from public.platform_support_messages m
        where m.id = message_id and m.is_internal = false
      )
    )
  );

drop policy if exists "platform_support_attachments_insert" on public.platform_support_attachments;
create policy "platform_support_attachments_insert"
  on public.platform_support_attachments for insert
  with check (
    tenant_id = (select current_tenant_id())
    and uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.platform_support_tickets t
      where t.id = ticket_id
        and t.tenant_id = (select current_tenant_id())
        and t.created_by = (select auth.uid())
    )
    and (
      message_id is null
      or exists (
        select 1 from public.platform_support_messages m
        where m.id = message_id and m.is_internal = false and m.author_side = 'agency'
      )
    )
  );

-- 5. Thread trigger ---------------------------------------------
--
-- Bumps last_message_at and re-opens a ticket that was waiting on the agency
-- when the agency replies. SECURITY DEFINER because the agency has no UPDATE
-- policy on tickets.
--
-- SAFETY: being SECURITY DEFINER this will bump ANY ticket_id. The only thing
-- stopping an agency bumping a stranger's ticket is that the messages INSERT
-- policy above refused the row first. Do not loosen that policy without
-- revisiting this function.

create or replace function public.platform_support_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  -- An internal note is not correspondence: it must not move anything the
  -- agency can see.
  if new.is_internal then
    return null;
  end if;

  update public.platform_support_tickets
     set last_message_at = new.created_at,
         status = case
           when new.author_side = 'agency' and status in ('waiting_on_agency', 'resolved')
             then 'open'
           else status
         end,
         resolved_at = case
           when new.author_side = 'agency' and status = 'resolved' then null
           else resolved_at
         end
   where id = new.ticket_id;

  return null;
end;
$$;

drop trigger if exists platform_support_messages_after_insert on public.platform_support_messages;
create trigger platform_support_messages_after_insert
  after insert on public.platform_support_messages
  for each row execute function public.platform_support_on_message();

-- 6. Storage bucket (private) -----------------------------------
-- Served via 1h signed URLs from the admin client, after the server has
-- re-checked that the caller may see the attachment row.

insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;
