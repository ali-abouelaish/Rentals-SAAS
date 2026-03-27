-- Phase 2 Feature Entitlements
-- Enables bookings, pm_tenants, and contracts features for all existing tenants.

insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'bookings', true from public.tenants
on conflict (tenant_id, feature_key) do nothing;

insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'pm_tenants', true from public.tenants
on conflict (tenant_id, feature_key) do nothing;

insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'contracts', true from public.tenants
on conflict (tenant_id, feature_key) do nothing;
