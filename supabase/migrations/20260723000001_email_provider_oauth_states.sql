-- Subdomain-safe OAuth state for the per-agency email provider connect flows
-- (Graph / Gmail). Agencies live on {slug}.harborops.co.uk, but an OAuth
-- redirect URI must be a single fixed host — so the callback lands on a
-- different host than the connect request and a cookie set on the tenant
-- subdomain does not survive. We therefore persist the PKCE verifier + state +
-- tenant in the DB (keyed by the opaque state nonce) exactly like
-- mydeposits_oauth_states, and the callback looks the tenant up by state.
--
-- Service-role only: RLS enabled, no policies (the admin client is the only
-- reader/writer; the row carries no long-lived secret, only a short-lived
-- one-time PKCE verifier).

create table if not exists public.email_provider_oauth_states (
  state         text primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  provider      text not null check (provider in ('graph','gmail')),
  code_verifier text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists email_provider_oauth_states_expires_idx
  on public.email_provider_oauth_states (expires_at);

alter table public.email_provider_oauth_states enable row level security;
-- Intentionally no policies: only the service-role admin client reads/writes.
