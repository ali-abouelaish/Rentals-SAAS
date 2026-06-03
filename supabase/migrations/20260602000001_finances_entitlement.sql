-- Finances feature entitlement
-- Grants 'finances' to every existing tenant by default; the page itself
-- still requires the property_management module via requireModuleAccess.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'finances'
from public.tenants
on conflict do nothing;
