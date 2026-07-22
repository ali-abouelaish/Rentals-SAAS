-- Multi-provider email transport, phase 1: per-agency email provider config
-- and an outbound audit log.
--
-- email_providers holds one row per tenant describing which transport to use
-- for that agency's tenant-facing mail (rent reminders first). When absent, or
-- when type='resend_default', or when status<>'active', the dispatcher falls
-- back to the central Resend mailer — so this table starts empty and nothing
-- changes until a provider is configured (via a future admin UI + OAuth flow).
--
-- The `credentials` column is AES-256-GCM ciphertext ({iv}:{ct}:{tag}, key =
-- EMAIL_PROVIDER_TOKEN_SECRET env) of a JSON blob: {accessToken,refreshToken,
-- expiry} for graph/gmail, {host,port,secure,user,pass} for smtp, null for
-- resend_default. Like tds_connections / dps_connections this is a secret-
-- holding table: RLS enabled, NO policies — only the service-role admin client
-- reads/writes it.

-- ============================================================
-- 1. email_providers — one transport config per tenant.
-- ============================================================
create table if not exists public.email_providers (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  type          text not null default 'resend_default'
                  check (type in ('resend_default','graph','gmail','smtp')),
  credentials   text,                                -- AES-256-GCM ciphertext (null for resend_default)
  from_address  text,
  from_name     text,
  reply_to      text,
  status        text not null default 'unverified'
                  check (status in ('active','unverified','disabled','error')),
  verified_at   timestamptz,
  last_error    text,
  connected_by  uuid references public.user_profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 2. email_log — outbound audit trail (one row per send attempt).
-- ============================================================
create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,  -- nullable: some sends lack a tenant
  provider_type text not null,
  "to"          text not null,
  subject       text,
  template_key  text,
  message_id    text,
  status        text not null check (status in ('sent','failed')),
  error         text,
  sent_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists email_log_tenant_sent_idx
  on public.email_log (tenant_id, sent_at desc);
create index if not exists email_log_message_id_idx
  on public.email_log (message_id);

-- ============================================================
-- 3. updated_at touch trigger (repo convention; own copy per integration).
-- ============================================================
create or replace function public.email_providers_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_providers_set_updated_at on public.email_providers;
create trigger email_providers_set_updated_at
before update on public.email_providers
for each row execute function public.email_providers_touch_updated_at();

-- ============================================================
-- 4. Row Level Security.
-- ============================================================
-- email_providers: service-role only (no policies) — holds an encrypted secret,
-- mirroring tds_connections / dps_connections.
alter table public.email_providers enable row level security;

-- email_log: no secret, but contains recipient PII. Agency members may read
-- their own tenant's log; writes go through the service-role admin client
-- (which bypasses RLS), so no insert/update/delete policies are defined.
alter table public.email_log enable row level security;

create policy "email_log_select"
  on public.email_log for select
  using (tenant_id = (select current_tenant_id()));
