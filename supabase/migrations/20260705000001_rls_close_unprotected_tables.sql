-- Security fix: enable Row-Level Security on tenant-data tables that were
-- created without it. Because the app trusts RLS as the real tenant boundary
-- (the anon key is public and PostgREST is directly reachable), any table
-- without RLS is a cross-tenant read/write for every authenticated user.
--
-- Tables closed here:
--   tenant_branding_settings   -> cross-tenant stored XSS via BrandingStyles
--   email_outbox               -> cross-tenant read of all outbound email + injection
--   tenant_feature_entitlements-> self-enable paid features / tamper competitors
--   tenant_access_profiles     -> cross-tenant read/write of permission profiles
--   organizations              -> legacy/unused mapping table
--
-- Uses the existing current_tenant_id() / is_admin() SECURITY DEFINER helpers
-- (see 20260129120003_rls.sql, 20260210120002_is_admin_include_super_admin.sql).
-- All server-side writers use the service-role admin client, which bypasses RLS,
-- so these policies do not break the worker or the super-admin panel.

-- ============================================================
-- tenant_branding_settings
-- Members read their own tenant's branding; admins edit their own.
-- (Public/unauthenticated reads go through the admin client and bypass RLS.)
-- ============================================================
alter table public.tenant_branding_settings enable row level security;

drop policy if exists "branding select" on public.tenant_branding_settings;
create policy "branding select"
  on public.tenant_branding_settings for select
  using (tenant_id = (select current_tenant_id()));

drop policy if exists "branding write" on public.tenant_branding_settings;
create policy "branding write"
  on public.tenant_branding_settings for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ============================================================
-- tenant_feature_entitlements
-- Members may READ their tenant's entitlements (getEntitlements uses the
-- SSR/anon client). NO write policy: entitlements are set only by the
-- super-admin panel via the service-role client, so tenant users can never
-- grant themselves paid features by writing directly to PostgREST.
-- ============================================================
alter table public.tenant_feature_entitlements enable row level security;

drop policy if exists "entitlements select" on public.tenant_feature_entitlements;
create policy "entitlements select"
  on public.tenant_feature_entitlements for select
  using (tenant_id = (select current_tenant_id()));

-- ============================================================
-- tenant_access_profiles
-- Members read their own tenant's permission profiles; admins manage them.
-- ============================================================
alter table public.tenant_access_profiles enable row level security;

drop policy if exists "access profiles select" on public.tenant_access_profiles;
create policy "access profiles select"
  on public.tenant_access_profiles for select
  using (tenant_id = (select current_tenant_id()));

drop policy if exists "access profiles write" on public.tenant_access_profiles;
create policy "access profiles write"
  on public.tenant_access_profiles for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ============================================================
-- email_outbox
-- Written and drained only by the service-role worker. Enable RLS with no
-- policies so anon/authenticated get zero access (service_role bypasses RLS);
-- this blocks both cross-tenant reads of email bodies and queue injection.
-- ============================================================
alter table public.email_outbox enable row level security;

-- ============================================================
-- organizations
-- Legacy slug->org mapping, unreferenced by application code. It was never
-- created in some environments, so guard on existence; where it does exist,
-- lock it down. If a future audit confirms it is dead, drop it in a follow-up.
-- ============================================================
do $$
begin
  if to_regclass('public.organizations') is not null then
    execute 'alter table public.organizations enable row level security';
  end if;
end $$;
