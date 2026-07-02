-- Catch-up migration.
--
-- 20260630000001_booking_share_offer.sql adds bookings.form_send_token (the
-- one-time token that binds an applicant's /apply submission back to the
-- pre-created share booking). On databases where that migration was recorded as
-- applied before the form_send_token line was appended to it, the column (and its
-- unique index) never got created — so the agent share-booking send fails with
-- "Could not find the 'form_send_token' column of 'bookings' in the schema cache".
--
-- Re-add both idempotently. Safe to run everywhere (no-ops where already present).

alter table public.bookings
  add column if not exists form_send_token uuid;

create unique index if not exists bookings_form_send_token_uniq
  on public.bookings (form_send_token) where form_send_token is not null;

-- Nudge PostgREST to refresh its schema cache so the new column is visible
-- immediately (Supabase also does this on DDL, but this makes it deterministic).
notify pgrst, 'reload schema';
