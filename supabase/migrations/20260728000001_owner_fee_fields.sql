-- ============================================================
-- Per-owner management-fee configuration on owner_landlords.
-- ============================================================
-- The management fee an agency charges an owner depends on the
-- landlord and the deal — some owners pay nothing, some a flat
-- monthly amount, some a percentage of rent collected. Config
-- lives on the owner record and defaults to 'none'. The fee line
-- on an owner statement is computed from these fields at
-- generation time (and can then be manually adjusted).
-- ============================================================

alter table public.owner_landlords
  add column management_fee_type text not null default 'none'
    check (management_fee_type in ('none', 'percent', 'flat')),
  -- Percentage of rent received in the period (e.g. 10.00 = 10%).
  add column management_fee_percent numeric(5,2),
  -- Flat monthly fee in POUNDS (consistent with monthly_rent_owed).
  add column management_fee_amount numeric(10,2);
