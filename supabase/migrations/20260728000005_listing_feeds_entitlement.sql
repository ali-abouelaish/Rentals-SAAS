-- Grant the listing_feeds (spreadsheet listing importer) feature to all existing
-- tenants. New tenants are covered by the default-on entitlement logic in
-- src/lib/entitlements/getEntitlements.ts.
insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'listing_feeds', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
