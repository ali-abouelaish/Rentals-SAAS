-- DPS (Deposit Protection Service / Computershare) integration, phase 1:
-- per-agency API credentials. Like TDS there is no software-provider tier —
-- every agency requests its own keys from its DPS account manager and a super
-- admin enters them on the agency's behalf. Unlike TDS the transport is OAuth
-- client-credentials (client_id + client_secret → 20-minute bearer token).
--
-- Mirrors public.tds_connections: the secret client_secret is AES-256-GCM
-- ciphertext ({iv}:{ct}:{tag}, key = DPS_TOKEN_SECRET env); the other
-- identifiers are non-secret. Service-role access only — RLS enabled, no
-- policies (the admin client is the only caller, exactly like
-- tds_connections / mydeposits_connections).

-- ============================================================
-- 1. dps_connections — one DPS credential set per tenant.
-- ============================================================
create table if not exists public.dps_connections (
  tenant_id         uuid primary key references public.tenants(id) on delete cascade,
  environment       text not null default 'uat'
                      check (environment in ('uat','production')),
  agent_landlord_id text not null,               -- 7-digit DPS account id (AgentLandlordId)
  client_id         text not null,
  client_secret     text not null,               -- AES-256-GCM ciphertext
  account_label     text,
  connected_by      uuid references public.user_profiles(id) on delete set null,
  last_verified_at  timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 2. updated_at touch trigger (repo convention; own copy per integration).
-- ============================================================
create or replace function public.dps_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dps_connections_set_updated_at on public.dps_connections;
create trigger dps_connections_set_updated_at
before update on public.dps_connections
for each row execute function public.dps_touch_updated_at();

-- ============================================================
-- 3. Row Level Security — service-role only (no policies).
-- ============================================================
alter table public.dps_connections enable row level security;
-- Intentionally no policies: only the service-role admin client reads/writes
-- this table (it holds an encrypted secret), mirroring tds_connections.
