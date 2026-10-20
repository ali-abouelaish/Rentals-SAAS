-- Grant the Email Sending feature (Settings → Email Sending, connecting the
-- agency's own Microsoft 365 / Gmail / SMTP mailbox) to all existing tenants.
-- It was ungated until now, so every agency already has it; this row is what
-- the super admin features manager toggles. New tenants are covered by the
-- default-on entitlement logic.
insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'email_sending', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
