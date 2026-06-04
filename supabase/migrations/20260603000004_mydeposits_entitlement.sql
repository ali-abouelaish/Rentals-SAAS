-- Deposit Protection (mydeposits) feature entitlement.
-- Grant 'mydeposits' to every existing tenant by default; the page itself
-- still requires the property_management module via requireModuleAccess.
-- Super admins can disable it per tenant from the features manager.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'mydeposits'
from public.tenants
on conflict do nothing;
