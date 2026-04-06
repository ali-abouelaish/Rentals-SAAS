-- Phase 4: Maintenance feature entitlement
-- Grant 'maintenance' feature to all existing tenants.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'maintenance'
from public.tenants
on conflict do nothing;
