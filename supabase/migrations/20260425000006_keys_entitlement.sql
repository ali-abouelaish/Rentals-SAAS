-- Keys feature entitlement
-- Grant 'keys' feature to all existing tenants by default.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'keys'
from public.tenants
on conflict do nothing;
