-- Allow quick-creating a pm_tenant with minimal / no details.
-- The inline "Create tenant" flow in the property unit Tenant tab lets agents
-- onboard a tenant into a room before all their details are known, so the core
-- identity columns must be nullable. The strict /tenants "Add Tenant" form still
-- requires them via Zod (pmTenantSchema); this only relaxes the DB constraint.

alter table public.pm_tenants alter column full_name drop not null;
alter table public.pm_tenants alter column email     drop not null;
alter table public.pm_tenants alter column phone     drop not null;
