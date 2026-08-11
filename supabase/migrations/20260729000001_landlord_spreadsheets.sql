-- ============================================================
-- Move spreadsheet listing imports onto the landlord record.
--
-- Supersedes 20260728000004/5, which modelled a spreadsheet source as a
-- standalone `listing_feeds` row surfaced on its own page. A landlord either
-- gives us a SpareRoom profile or a spreadsheet, so the link belongs next to
-- `spareroom_profile_url` on the landlord — no separate entity, no separate tab.
--
-- Written to be correct whether or not the superseded migrations were applied:
-- the drops are `if exists` and the adds are `if not exists`.
-- ============================================================

-- ------------------------------------------------------------
-- Remove the standalone feed model
-- ------------------------------------------------------------
drop table if exists public.listing_feed_runs cascade;
drop table if exists public.listing_feeds cascade;

-- `feed_id` pointed at listing_feeds; the landlord is now the owner of an
-- imported row. Dropping the column also drops its dependent unique index.
alter table public.scraped_listings drop column if exists feed_id;

-- The entitlement is gone too — spreadsheet import is part of Landlords now and
-- rides on the existing `landlords` entitlement.
delete from public.tenant_feature_entitlements where feature_key = 'listing_feeds';

-- ------------------------------------------------------------
-- Landlord spreadsheet source
-- ------------------------------------------------------------
-- The pasted link: a Google Sheet, or a hosted .csv/.xlsx. Null means this
-- landlord has no spreadsheet (they may still have a SpareRoom profile).
alter table public.landlords
  add column if not exists spreadsheet_url text;

-- Zero-based index of the header row. Detected on first import, overridable
-- from the landlord page (sheets often open with a title or logo row).
alter table public.landlords
  add column if not exists spreadsheet_header_row int not null default 0;

-- { "<sheet header>": "<scraped_listings column>" }. Auto-detected on the first
-- import, then confirmed/corrected by the user. Stored so later re-reads replay
-- the confirmed mapping instead of silently re-guessing.
alter table public.landlords
  add column if not exists spreadsheet_column_map jsonb not null default '{}'::jsonb;

alter table public.landlords
  add column if not exists spreadsheet_last_run_at timestamptz;
alter table public.landlords
  add column if not exists spreadsheet_last_status text
    check (spreadsheet_last_status in ('success', 'failed', 'running'));
alter table public.landlords
  add column if not exists spreadsheet_last_error text;
alter table public.landlords
  add column if not exists spreadsheet_last_row_count int;

-- Drives the daily sweep: landlords that have a sheet, oldest read first.
create index if not exists idx_landlords_spreadsheet
  on public.landlords(spreadsheet_last_run_at)
  where spreadsheet_url is not null;

-- ------------------------------------------------------------
-- Import history
-- ------------------------------------------------------------
create table if not exists public.landlord_sheet_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  landlord_id uuid not null references public.landlords(id) on delete cascade,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  -- Distinguishes the daily sweep from someone pressing "Import now".
  trigger text not null default 'schedule'
    check (trigger in ('schedule', 'manual')),

  rows_seen int not null default 0,
  rows_created int not null default 0,
  rows_updated int not null default 0,
  rows_skipped int not null default 0,
  error_message text,
  -- Per-row notes (skipped rows, unmatched values), capped at 50 by the
  -- importer so one malformed sheet cannot bloat the table.
  notes jsonb not null default '[]'::jsonb
);

create index if not exists idx_landlord_sheet_runs_landlord
  on public.landlord_sheet_runs(landlord_id, started_at desc);
create index if not exists idx_landlord_sheet_runs_tenant
  on public.landlord_sheet_runs(tenant_id);

-- ------------------------------------------------------------
-- scraped_listings provenance
-- ------------------------------------------------------------
-- Existing rows all came from the SpareRoom scraper, so 'spareroom' is the
-- correct backfill default. Spreadsheet imports write 'spreadsheet'.
alter table public.scraped_listings
  add column if not exists source text not null default 'spareroom';
-- Stable per-row identity within one landlord's sheet (the sheet's own
-- reference column, else the listing URL, else a content hash), so a re-read
-- updates the same listing instead of duplicating it.
alter table public.scraped_listings
  add column if not exists external_ref text;
-- Stamped on every read that still sees the row, so listings that drop off the
-- sheet are identifiable without deleting anything.
alter table public.scraped_listings
  add column if not exists last_seen_at timestamptz;
-- The untouched source row, for debugging a bad mapping after the fact.
alter table public.scraped_listings
  add column if not exists raw_row jsonb;

-- Dedupe key and the conflict target the importer infers. Deliberately NOT a
-- partial index: `on conflict (landlord_id, external_ref)` cannot infer a
-- partial index without repeating its predicate, which the Supabase client
-- cannot express. Safe because Postgres treats NULLs as distinct by default, so
-- SpareRoom rows (external_ref null) never collide with each other.
create unique index if not exists uniq_scraped_listings_landlord_ref
  on public.scraped_listings(landlord_id, external_ref);

create index if not exists idx_scraped_listings_source
  on public.scraped_listings(tenant_id, source);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.landlord_sheet_runs enable row level security;

drop policy if exists "landlord_sheet_runs select" on public.landlord_sheet_runs;
create policy "landlord_sheet_runs select"
on public.landlord_sheet_runs for select
using (tenant_id = current_tenant_id());

drop policy if exists "landlord_sheet_runs insert" on public.landlord_sheet_runs;
create policy "landlord_sheet_runs insert"
on public.landlord_sheet_runs for insert
with check (tenant_id = current_tenant_id());

drop policy if exists "landlord_sheet_runs update" on public.landlord_sheet_runs;
create policy "landlord_sheet_runs update"
on public.landlord_sheet_runs for update
using (tenant_id = current_tenant_id())
with check (tenant_id = current_tenant_id());

drop policy if exists "landlord_sheet_runs delete" on public.landlord_sheet_runs;
create policy "landlord_sheet_runs delete"
on public.landlord_sheet_runs for delete
using (tenant_id = current_tenant_id());
