-- Per-agency reply-to address + generic error_events sink for email send failures.
--
-- Schema mapping:
--   tenants = the SaaS multi-tenant table (the agency)

-- 1. Per-agency reply-to address.
alter table public.tenants
  add column if not exists contact_email text;

-- Backfill from any existing branding.reply_to_email; otherwise a placeholder
-- on a domain we control so misconfigured tenants fail loudly at send time
-- (the runtime check refuses to send to this address).
update public.tenants
set contact_email = coalesce(
  nullif(branding->>'reply_to_email', ''),
  'replies-not-configured@harborops.co.uk'
)
where contact_email is null;

alter table public.tenants
  alter column contact_email set not null;

alter table public.tenants
  add constraint tenants_contact_email_format
  check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- 2. Generic error events sink. First consumer is email send failures
-- (source = 'email_send'); kept generic so other subsystems can reuse it.
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists error_events_tenant_created_idx
  on public.error_events (tenant_id, created_at desc);
create index if not exists error_events_source_created_idx
  on public.error_events (source, created_at desc);

alter table public.error_events enable row level security;

create policy "Tenant members read error_events"
  on public.error_events
  for select
  using (
    tenant_id in (
      select tenant_id from public.user_profiles where id = (select auth.uid())
    )
  );
-- Writes are admin-client only (no insert/update/delete policies).
