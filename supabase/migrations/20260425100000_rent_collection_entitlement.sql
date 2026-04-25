-- Rent Collection feature entitlement
-- Grant 'rent_collection' to every existing tenant by default; the page itself
-- still requires the property_management module via requireModuleAccess.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'rent_collection'
from public.tenants
on conflict do nothing;
