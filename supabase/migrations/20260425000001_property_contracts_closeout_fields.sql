-- End-of-tenancy fields on property_contracts.
-- Captures real move-out (distinct from `vacate_date`, which is the
-- scheduled/expected date set at notice-give time) plus closeout metadata
-- consumed by the tenant-history timeline on properties/units.

alter table property_contracts
  add column if not exists actual_end_date date;

alter table property_contracts
  add column if not exists end_reason text
    check (end_reason in (
      'tenant_notice','landlord_notice','mutual','breach','abandoned','other'
    ));

-- Stored in whole pounds to match the existing convention on
-- property_contracts.rent_pcm and property_contracts.deposit.
alter table property_contracts
  add column if not exists arrears_at_end integer not null default 0;

alter table property_contracts
  add column if not exists would_relet boolean;

alter table property_contracts
  add column if not exists end_notes text;

-- Active tenancies (no actual_end_date) sort to the top of per-unit history.
create index if not exists property_contracts_unit_id_actual_end_idx
  on property_contracts (unit_id, actual_end_date desc nulls first);
