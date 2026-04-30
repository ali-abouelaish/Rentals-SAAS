-- Rent reminder email system
--
-- Schema mapping for this migration:
--   tenants     = the SaaS multi-tenant table (the agency)
--   pm_tenants  = the actual rental tenants (the people receiving reminders)
--   property_contracts = the active rent agreement (has rent_pcm + collection_date)
--   rent_payments = payment-per-contract-per-month, used to determine "paid"

-- 1. Agency branding (stored on tenants)
alter table public.tenants
  add column if not exists branding jsonb not null default '{}'::jsonb;

-- 2. Per-renter email controls (stored on pm_tenants)
alter table public.pm_tenants
  add column if not exists email_status text not null default 'active'
    check (email_status in ('active','bounced','complained','unsubscribed'));
alter table public.pm_tenants
  add column if not exists reminders_enabled boolean not null default true;

-- 3. Idempotency + audit log
create table if not exists public.rent_reminder_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid not null references public.property_contracts(id) on delete cascade,
  pm_tenant_id uuid not null references public.pm_tenants(id) on delete cascade,
  reminder_type text not null check (reminder_type in
    ('upcoming_5d','due_today','overdue_3d','overdue_7d','overdue_14d')),
  period_start date not null,
  sent_at timestamptz not null default now(),
  email_provider_id text,
  status text not null default 'sent' check (status in ('sent','failed')),
  error_message text,
  unique (contract_id, period_start, reminder_type)
);

create index if not exists rent_reminder_log_tenant_sent_idx
  on public.rent_reminder_log (tenant_id, sent_at desc);
create index if not exists rent_reminder_log_pm_tenant_sent_idx
  on public.rent_reminder_log (pm_tenant_id, sent_at desc);
create index if not exists rent_reminder_log_provider_id_idx
  on public.rent_reminder_log (email_provider_id);

-- 4. RLS
alter table public.rent_reminder_log enable row level security;

create policy "Tenant members can read rent_reminder_log"
  on public.rent_reminder_log
  for select
  using (
    tenant_id in (
      select tenant_id from public.user_profiles where id = (select auth.uid())
    )
  );

-- Writes are server-only via the admin client (cron + webhook).
