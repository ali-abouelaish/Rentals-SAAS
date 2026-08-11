-- Feature entitlement for the owner statements & ledger module. Grant to
-- every existing tenant; new tenants default to enabled via getEntitlements'
-- default-on behaviour.
insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'owner_statements', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
