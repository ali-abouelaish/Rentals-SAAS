-- Add missing landlord columns (commission_amount_gbp, commission_term_text, profile_notes)
-- Safe to run: uses IF NOT EXISTS so existing columns are unchanged

alter table landlords
  add column if not exists commission_amount_gbp numeric(12,2) not null default 0;

alter table landlords
  add column if not exists commission_term_text text;

alter table landlords
  add column if not exists profile_notes text;
