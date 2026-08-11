-- ============================================================
-- Mark a maintenance cost as rechargeable to the property owner.
-- ============================================================
-- Owner statements previously deducted EVERY maintenance cost in
-- the period from the owner, with no way to absorb one. Not every
-- cost is the owner's: tenant-fault damage, goodwill repairs and
-- work covered by the agency's own margin are not rechargeable.
--
-- This flag is the single source of truth for whether a cost ever
-- reaches an owner statement. It is editable both on the cost
-- itself and from the statement line (which writes back here and
-- re-derives), so there is only ever one place the answer lives.
--
-- Defaults to true so existing rows keep today's behaviour — a
-- default of false would silently under-charge every owner.
-- ============================================================

alter table public.maintenance_costs
  add column if not exists recharge_to_owner boolean not null default true;

comment on column public.maintenance_costs.recharge_to_owner is
  'When false the cost is absorbed by the agency (or the tenant) and never appears on an owner statement.';

-- Statement generation filters costs by job + date + this flag.
create index if not exists maintenance_costs_recharge_idx
  on public.maintenance_costs (tenant_id, job_id, date_incurred)
  where recharge_to_owner;
