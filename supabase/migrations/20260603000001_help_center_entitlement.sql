-- Grant the Help Center feature to every existing tenant so it appears in the
-- super admin features manager and can be toggled per tenant. The in-app
-- entitlement check (getEntitlements) default-enables non-admin features even
-- without a row, so this migration only makes it manageable, not functional.
insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'help_center' from public.tenants
on conflict do nothing;
