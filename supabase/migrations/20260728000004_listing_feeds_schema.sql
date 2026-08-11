-- ============================================================
-- Listing Feeds — generic spreadsheet scraper for the rental agency module.
--
-- A "feed" is a saved spreadsheet source (Google Sheet, or any hosted
-- .csv/.xlsx) that gets re-pulled on a schedule. Each pull parses the sheet,
-- applies the feed's saved column mapping, and upserts rows into the existing
-- `scraped_listings` table so imported listings immediately flow into the
-- public API, landlord pages and Gmail lead matching.
--
-- Tables:
--   listing_feeds      — one row per saved source (URL + column mapping + schedule)
--   listing_feed_runs  — one row per pull, the audit trail
-- Plus provenance columns on scraped_listings so spreadsheet rows can be told
-- apart from SpareRoom scraper output and rolled back per feed.
-- ============================================================

-- ------------------------------------------------------------
-- listing_feeds
-- ------------------------------------------------------------
create table if not exists public.listing_feeds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  name text not null,
  -- The URL exactly as the user pasted it. Kept verbatim so the UI can show it
  -- back to them; the resolved fetch target is derived at run time.
  source_url text not null,
  -- google_sheet: fetched via the sheet's CSV export endpoint (or the Sheets
  -- API when a service account is configured). csv_url / xlsx_url: fetched
  -- directly over HTTPS.
  source_kind text not null default 'google_sheet'
    check (source_kind in ('google_sheet', 'csv_url', 'xlsx_url')),
  -- Parsed out of a Google Sheets URL so the export endpoint can be rebuilt
  -- without re-parsing. Null for direct file URLs.
  sheet_id text,
  sheet_gid text,

  -- Zero-based index of the header row within the sheet. Detected on preview,
  -- overridable by the user (spreadsheets often carry title/banner rows).
  header_row int not null default 0,
  -- { "<sheet header>": "<scraped_listings column>" }. Headers the user left
  -- unmapped are simply absent. Confirmed by the user on the mapping screen,
  -- so a re-pull never silently re-guesses.
  column_map jsonb not null default '{}'::jsonb,

  -- Fallback landlord for every row in this feed — used when the sheet has no
  -- landlord column, or when a row's landlord name matches nothing.
  landlord_id uuid references public.landlords(id) on delete set null,

  frequency text not null default 'daily'
    check (frequency in ('hourly', 'daily', 'weekly', 'manual')),
  status text not null default 'active'
    check (status in ('active', 'paused')),

  last_run_at timestamptz,
  last_status text check (last_status in ('success', 'failed', 'running')),
  last_error text,
  last_row_count int,

  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listing_feeds_tenant on public.listing_feeds(tenant_id);
-- Drives the cron sweep: find active feeds whose last run is older than their
-- cadence, oldest first.
create index if not exists idx_listing_feeds_due
  on public.listing_feeds(status, last_run_at);

-- ------------------------------------------------------------
-- listing_feed_runs
-- ------------------------------------------------------------
create table if not exists public.listing_feed_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feed_id uuid not null references public.listing_feeds(id) on delete cascade,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  -- Distinguishes a scheduled sweep from someone hitting "Run now".
  trigger text not null default 'schedule'
    check (trigger in ('schedule', 'manual')),

  rows_seen int not null default 0,
  rows_created int not null default 0,
  rows_updated int not null default 0,
  rows_skipped int not null default 0,
  error_message text,
  -- Per-row reasons rows were skipped, capped at 50 entries by the importer so
  -- one malformed sheet cannot bloat the table.
  skip_reasons jsonb not null default '[]'::jsonb
);

create index if not exists idx_listing_feed_runs_feed
  on public.listing_feed_runs(feed_id, started_at desc);
create index if not exists idx_listing_feed_runs_tenant
  on public.listing_feed_runs(tenant_id);

-- ------------------------------------------------------------
-- scraped_listings provenance
-- ------------------------------------------------------------
-- Existing rows all came from the SpareRoom scraper, so 'spareroom' is the
-- correct backfill default for them.
alter table public.scraped_listings
  add column if not exists source text not null default 'spareroom';
alter table public.scraped_listings
  add column if not exists feed_id uuid references public.listing_feeds(id) on delete set null;
-- Stable per-row identity within a feed (the row's URL, reference, or a hash of
-- its identifying fields). Lets a re-pull update the same listing instead of
-- duplicating it.
alter table public.scraped_listings
  add column if not exists external_ref text;
-- Stamped on every pull that still sees the row, so listings that fall off the
-- sheet are identifiable without deleting anything.
alter table public.scraped_listings
  add column if not exists last_seen_at timestamptz;
-- The untouched source row, for debugging a bad mapping after the fact.
alter table public.scraped_listings
  add column if not exists raw_row jsonb;

-- Dedupe key for feed upserts, and the conflict target the importer infers.
-- Deliberately NOT a partial index: `on conflict (feed_id, external_ref)`
-- cannot infer a partial index without repeating its predicate, which the
-- Supabase client cannot express. A plain unique index is safe here because
-- Postgres treats NULLs as distinct by default, so SpareRoom rows (feed_id and
-- external_ref both null) never collide with each other.
create unique index if not exists uniq_scraped_listings_feed_ref
  on public.scraped_listings(feed_id, external_ref);

create index if not exists idx_scraped_listings_source
  on public.scraped_listings(tenant_id, source);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.listing_feeds enable row level security;
alter table public.listing_feed_runs enable row level security;

drop policy if exists "listing_feeds select" on public.listing_feeds;
create policy "listing_feeds select"
on public.listing_feeds for select
using (tenant_id = current_tenant_id());

drop policy if exists "listing_feeds insert" on public.listing_feeds;
create policy "listing_feeds insert"
on public.listing_feeds for insert
with check (tenant_id = current_tenant_id());

drop policy if exists "listing_feeds update" on public.listing_feeds;
create policy "listing_feeds update"
on public.listing_feeds for update
using (tenant_id = current_tenant_id())
with check (tenant_id = current_tenant_id());

drop policy if exists "listing_feeds delete" on public.listing_feeds;
create policy "listing_feeds delete"
on public.listing_feeds for delete
using (tenant_id = current_tenant_id());

-- Runs are written by the cron job through the admin client (which bypasses
-- RLS); tenant users only ever read their own history.
drop policy if exists "listing_feed_runs select" on public.listing_feed_runs;
create policy "listing_feed_runs select"
on public.listing_feed_runs for select
using (tenant_id = current_tenant_id());

drop policy if exists "listing_feed_runs insert" on public.listing_feed_runs;
create policy "listing_feed_runs insert"
on public.listing_feed_runs for insert
with check (tenant_id = current_tenant_id());

drop policy if exists "listing_feed_runs update" on public.listing_feed_runs;
create policy "listing_feed_runs update"
on public.listing_feed_runs for update
using (tenant_id = current_tenant_id())
with check (tenant_id = current_tenant_id());

drop policy if exists "listing_feed_runs delete" on public.listing_feed_runs;
create policy "listing_feed_runs delete"
on public.listing_feed_runs for delete
using (tenant_id = current_tenant_id());
