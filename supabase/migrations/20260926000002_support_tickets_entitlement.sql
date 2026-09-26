-- Grant the support tickets (Contact Support) feature to all existing tenants.
-- New tenants are covered by the default-on entitlement logic.
insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'support_tickets', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
