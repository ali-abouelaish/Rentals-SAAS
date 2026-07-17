-- Tenant Portal feature entitlement.
-- Grant 'tenant_portal' to every existing tenant by default (mirrors the
-- tds/mydeposits entitlements). Super admins can disable it per tenant from
-- the features manager; when disabled the renter-facing /portal 404s and the
-- staff "Portal link" action is hidden.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'tenant_portal'
from public.tenants
on conflict do nothing;
