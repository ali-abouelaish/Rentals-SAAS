-- Seed the contract_templates entitlement for all existing tenants.
insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'contract_templates', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
