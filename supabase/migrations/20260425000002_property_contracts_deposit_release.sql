-- End-of-tenancy deposit release tracking on property_contracts.
-- Stored in whole pounds to match the existing convention on
-- property_contracts.deposit and property_contracts.rent_pcm.
--
-- deposit_returned IS NULL  → not yet released
-- deposit_returned = deposit → released in full
-- 0 < deposit_returned < deposit → partial release (deductions)
-- deposit_returned = 0       → fully retained

alter table property_contracts
  add column if not exists deposit_returned integer;

alter table property_contracts
  add column if not exists deposit_returned_at date;

alter table property_contracts
  add column if not exists deposit_release_notes text;

-- Sanity guard: never let "returned" exceed what was held.
alter table property_contracts
  drop constraint if exists property_contracts_deposit_returned_chk;

alter table property_contracts
  add constraint property_contracts_deposit_returned_chk
  check (
    deposit_returned is null
    or (deposit_returned >= 0 and deposit_returned <= deposit)
  );
