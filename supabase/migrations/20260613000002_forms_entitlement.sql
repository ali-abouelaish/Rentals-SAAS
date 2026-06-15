insert into public.tenant_feature_entitlements (tenant_id, feature_key)
select id, 'forms' from public.tenants
on conflict do nothing;
