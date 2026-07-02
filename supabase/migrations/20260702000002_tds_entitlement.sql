-- TDS Deposit Protection feature entitlement.
-- Grant 'tds' to every existing tenant by default (mirrors the mydeposits
-- entitlement). The /deposits TDS subtab only becomes actionable once a super
-- admin configures the agency's TDS credentials; until then it shows a
-- "not configured" state. Super admins can disable it per tenant from the
-- features manager.

insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'tds'
from public.tenants
on conflict do nothing;
