-- ============================================================
-- Per-statement management-fee override.
-- ============================================================
-- The fee on owner_landlords is the landlord's STANDING deal. A
-- given month often departs from it — a void period, a discount
-- while works run, a one-off flat charge instead of the usual
-- percentage. Overriding the standing config to fix one month
-- would silently rewrite every future statement, so the override
-- is stored on the statement itself.
--
-- All three columns null  = use the owner's standing config.
-- fee_override_type 'none' = deliberately no fee this period
--                            (distinct from "not overridden").
-- ============================================================

alter table public.owner_statements
  add column if not exists fee_override_type text
    check (fee_override_type in ('none', 'percent', 'flat')),
  -- Percentage of rent received this period (e.g. 10.00 = 10%).
  add column if not exists fee_override_percent numeric(5,2),
  -- Flat amount for this period in POUNDS (matches management_fee_amount).
  add column if not exists fee_override_amount numeric(10,2),
  -- Audit: who moved off the standing deal, and when.
  add column if not exists fee_override_by uuid references public.user_profiles(id) on delete set null,
  add column if not exists fee_override_at timestamptz;

comment on column public.owner_statements.fee_override_type is
  'Null means use owner_landlords.management_fee_*; ''none'' means no fee for this period.';
