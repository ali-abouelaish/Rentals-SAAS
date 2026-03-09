-- Run this in Supabase Dashboard > SQL Editor to add missing landlord columns.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE landlords
  ADD COLUMN IF NOT EXISTS commission_amount_gbp numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE landlords
  ADD COLUMN IF NOT EXISTS commission_term_text text;

ALTER TABLE landlords
  ADD COLUMN IF NOT EXISTS profile_notes text;
