-- ============================================================
-- Composite row identity for landlord listing spreadsheets.
--
-- Many sheets carry no unique reference column, but a combination of columns is
-- unique — "Address" + "Room Type", say, or "Address" + "Rent". This stores the
-- user's chosen combination so the importer can build a stable `external_ref`
-- from it, instead of falling back to a fingerprint of title/address/price that
-- changes whenever any of those are edited.
--
-- A JSON array of sheet header names, e.g. '["Property Address","Room Type"]'.
-- Empty array = fall back to the default identity chain (mapped reference
-- column, then listing URL, then the title/address/price fingerprint).
-- ============================================================

alter table public.landlords
  add column if not exists spreadsheet_key_columns jsonb not null default '[]'::jsonb;
