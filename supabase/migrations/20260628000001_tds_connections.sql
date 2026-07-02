-- TDS (Tenancy Deposit Scheme / The Dispute Service) custodial integration.
-- Unlike mydeposits (a single platform-level OAuth app), TDS has no software-
-- provider tier: every agency applies to TDS individually and receives its own
-- static credentials (member_id, branch_id, api_key). A super admin enters those
-- on the agency's behalf. This migration stores one credential set per tenant.
--
-- Mirrors public.mydeposits_connections: the secret api_key is AES-256-GCM
-- ciphertext ({iv}:{ct}:{tag}); the other identifiers are non-secret. Service-
-- role access only — RLS enabled, no policies (the admin client is the only
-- caller, exactly like mydeposits_connections / tenant_gmail_connections).

-- ============================================================
-- 1. tds_connections — one TDS credential set per tenant.
-- ============================================================
create table if not exists public.tds_connections (
  tenant_id        uuid primary key references public.tenants(id) on delete cascade,
  environment      text not null default 'sandbox'
                     check (environment in ('sandbox','production')),
  member_id        text not null,
  branch_id        text not null default '0',
  api_key          text not null,                 -- AES-256-GCM ciphertext
  region           text not null default 'EW'
                     check (region in ('EW','NI')),
  scheme_type      text not null default 'Custodial'
                     check (scheme_type in ('Custodial','Insured')),
  account_label    text,
  connected_by     uuid references public.user_profiles(id) on delete set null,
  last_verified_at timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- 2. updated_at touch trigger (repo convention).
-- ============================================================
create or replace function public.tds_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tds_connections_set_updated_at on public.tds_connections;
create trigger tds_connections_set_updated_at
before update on public.tds_connections
for each row execute function public.tds_touch_updated_at();

-- ============================================================
-- 3. Row Level Security — service-role only (no policies).
-- ============================================================
alter table public.tds_connections enable row level security;
-- Intentionally no policies: only the service-role admin client reads/writes
-- this table (it holds an encrypted secret), mirroring mydeposits_connections.
