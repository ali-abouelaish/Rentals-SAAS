-- AI Maintenance Triage Phase 4
-- Adds landlord alert phone to tenants. Used to substitute "landlord" in
-- emergency triage responses (water leak / lockout / no-heat-cold cases).

alter table public.tenants add column if not exists alert_phone text;
