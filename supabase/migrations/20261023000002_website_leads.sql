-- Website lead capture: an agency's own website POSTs enquiries to
-- /api/public/leads with a per-agency API key scoped `leads:write`.
--
-- 1. leads.api_key_id records which connected website (key) delivered a lead,
--    so Leads → Settings can show per-website counts and the lead drawer can
--    say "via Main website". ON DELETE SET NULL: deleting a key keeps its leads.
-- 2. Seeds the `website_leads` entitlement for every tenant. The feature is
--    default-on; this row is what the super admin features manager toggles.
-- 3. Restricts writes on public_api_keys to admins. The insert/update/delete
--    policies only checked the tenant, so any team member could mint or revoke
--    keys straight through PostgREST and skip requireRole(ADMIN_ROLES) in the
--    server actions. is_admin() accepts admin and super_admin — the same roles
--    as ADMIN_ROLES — so the existing actions keep working. Reads stay
--    tenant-wide: the Leads page shows "via <key label>" to every member.
-- 4. Limits scopes to the known set, so a new scope has to be added here
--    deliberately (keep in step with API_SCOPES in src/lib/api-keys/scopes.ts).
--    NOT VALID: enforced for new and updated rows without re-checking old ones.
--
-- Additive, so it is safe to apply ahead of the code — and it must be applied
-- BEFORE the code deploys, because the endpoint writes leads.api_key_id.

alter table public.leads
  add column if not exists api_key_id uuid references public.public_api_keys(id) on delete set null;

-- Per-website counts on Leads → Settings, and the lookup behind the FK's
-- ON DELETE SET NULL.
create index if not exists idx_leads_api_key
  on public.leads (api_key_id, created_at desc)
  where api_key_id is not null;

insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'website_leads', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;

drop policy if exists "public_api_keys insert" on public.public_api_keys;
create policy "public_api_keys insert"
on public.public_api_keys for insert
with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "public_api_keys update" on public.public_api_keys;
create policy "public_api_keys update"
on public.public_api_keys for update
using (tenant_id = (select current_tenant_id()) and (select is_admin()))
with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

drop policy if exists "public_api_keys delete" on public.public_api_keys;
create policy "public_api_keys delete"
on public.public_api_keys for delete
using (tenant_id = (select current_tenant_id()) and (select is_admin()));

alter table public.public_api_keys
  drop constraint if exists public_api_keys_scopes_known;
alter table public.public_api_keys
  add constraint public_api_keys_scopes_known
  check (scopes <@ array['scraped_listings:read', 'leads:write']::text[]) not valid;
