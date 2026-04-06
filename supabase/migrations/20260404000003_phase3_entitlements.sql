-- Phase 3: Add 'profitability' feature entitlement for all existing tenants.

insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'profitability', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
