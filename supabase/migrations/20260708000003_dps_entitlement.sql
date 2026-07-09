-- DPS Deposit Protection feature entitlement.
-- Grant 'dps' to every existing tenant by default (mirrors the tds/mydeposits
-- entitlements). The /deposits DPS subtab only becomes actionable once a super
-- admin configures the agency's DPS credentials; until then it shows a
-- "not configured" state. Super admins can disable it per tenant from the
-- features manager.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'dps'
from public.tenants
on conflict do nothing;
