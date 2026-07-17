-- Tenant portal visibility columns. The portal itself is stateless (HMAC
-- tokens, no session table); these timestamps give staff visibility into
-- who has been invited and who actually signs in.

alter table public.pm_tenants
  add column if not exists portal_invited_at timestamptz,
  add column if not exists last_portal_login_at timestamptz;
