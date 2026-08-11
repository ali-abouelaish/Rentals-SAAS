-- Listing freshness tracking.
--
-- Both pipelines that write into scraped_listings (the SpareRoom scraper and the
-- landlord spreadsheet importer) could leave rows behind indefinitely, and
-- nothing in the schema expressed how old a listing actually was: `status` is
-- hardcoded 'available' on every scraped row, so a listing last confirmed live
-- in April looked identical to one confirmed this morning.
--
-- This adds the missing signal at both levels:
--   landlords.last_scraped_at       — when we last successfully read this
--                                     landlord's source, so a landlord that has
--                                     been failing for months is visible as such
--   scraped_listings.last_seen_at   — when this individual listing was last
--                                     confirmed live at its source
--
-- last_seen_at / source / external_ref were introduced by
-- 20260729000001_landlord_spreadsheets.sql for the spreadsheet importer. They are
-- re-asserted here with `if not exists` so this migration is self-sufficient if
-- that one has not been applied yet, and a no-op if it has.

-- ------------------------------------------------------------
-- landlords.last_scraped_at
-- ------------------------------------------------------------
-- Deliberately nullable with no default and no backfill: NULL means "never
-- successfully read", which is exactly the state we want to surface rather than
-- paper over with now(). Stamped only for landlords a run could actually read,
-- so one that cannot be reached keeps its old value and visibly ages.
alter table public.landlords
  add column if not exists last_scraped_at timestamptz;

comment on column public.landlords.last_scraped_at is
  'When this landlord''s listing source was last read end-to-end. NULL = never. Not stamped when a run fails to reach them, so staleness stays visible.';

-- Cheapest way to answer "which landlords have gone stale", the query behind the
-- freshness warning in the app. NULLs sort first so never-read landlords lead.
create index if not exists idx_landlords_tenant_last_scraped
  on public.landlords(tenant_id, last_scraped_at nulls first);

-- ------------------------------------------------------------
-- scraped_listings freshness columns
-- ------------------------------------------------------------
-- Existing rows all came from the SpareRoom scraper, so 'spareroom' is the
-- correct backfill default. Spreadsheet imports write 'spreadsheet'.
alter table public.scraped_listings
  add column if not exists source text not null default 'spareroom';

-- Stamped on every read that still sees the listing at its source.
alter table public.scraped_listings
  add column if not exists last_seen_at timestamptz;

alter table public.scraped_listings
  add column if not exists external_ref text;

comment on column public.scraped_listings.last_seen_at is
  'When this listing was last confirmed live at its source. NULL on rows written before freshness tracking existed — treat as unknown age, not fresh.';

-- Backfill the rows that predate the column. created_at is the honest value for
-- SpareRoom rows specifically: that pipeline deletes and re-inserts per run, so
-- created_at already *is* the last time the row was confirmed live. Spreadsheet
-- rows are upserted in place, so their created_at is the first import rather than
-- the last read and would overstate freshness -- those are left NULL.
update public.scraped_listings
   set last_seen_at = created_at
 where last_seen_at is null
   and source = 'spareroom';

-- Drives the freshness filter on the public API and the stale-listing sweep.
create index if not exists idx_scraped_listings_tenant_last_seen
  on public.scraped_listings(tenant_id, last_seen_at nulls first);

-- RLS: both tables already have row level security enabled with tenant-scoped
-- policies (landlords in the base schema, scraped_listings in
-- 20260210120003_scraped_listings_table.sql). Adding columns does not change the
-- policy surface, so no policy changes are needed here.
