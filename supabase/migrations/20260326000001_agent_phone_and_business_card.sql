-- Add phone number field to agent_profiles
alter table public.agent_profiles
  add column if not exists phone text;

-- Seed the 'digital_business_card' entitlement for all existing tenants
-- Absent rows default to enabled in getEntitlements(), so this just makes it explicit
insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'digital_business_card', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
