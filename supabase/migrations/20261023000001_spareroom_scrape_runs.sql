-- Per-agency history of full SpareRoom scrapes.
--
-- Written by both the daily 09:00 job (trigger 'schedule') and the
-- "Scrape all now" button on the Landlords page (trigger 'manual'), so an
-- agency can see whether its scrape worked — until now the outcome was only in
-- platform_job_runs, which only super admins can read. Single-landlord
-- "Run scraper" presses are not recorded here; they stamp
-- landlords.last_scraped_at as before.
--
-- Rows are written server-side with the service-role client only
-- (src/lib/scrapers/scrapeRuns.ts). Agency users get a select policy and
-- nothing else, so they cannot forge or edit run history.

create table if not exists public.spareroom_scrape_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  trigger text not null default 'schedule'
    check (trigger in ('schedule', 'manual')),
  -- Snapshot of who pressed the button; null for scheduled runs.
  started_by_name text,

  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,

  landlords_total int,
  landlords_refreshed int,
  listings_posted int,
  listings_swept int,
  -- [{ "id": uuid, "name": text }]: landlords the run could not read end-to-end
  -- (their listings were left as they were and will age).
  unreadable jsonb not null default '[]'::jsonb,
  -- Same shape: landlords read cleanly with no live listings (their old rows
  -- were removed).
  cleared jsonb not null default '[]'::jsonb,
  error_message text
);

create index if not exists idx_spareroom_scrape_runs_tenant
  on public.spareroom_scrape_runs(tenant_id, started_at desc);

-- One running scrape per agency, whoever started it. This is what stops the
-- button and the daily job (or two admins) starting overlapping runs, which
-- would each sweep the rows the other just wrote.
create unique index if not exists uniq_spareroom_scrape_runs_running
  on public.spareroom_scrape_runs(tenant_id)
  where status = 'running';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.spareroom_scrape_runs enable row level security;

drop policy if exists "spareroom_scrape_runs select" on public.spareroom_scrape_runs;
create policy "spareroom_scrape_runs select"
on public.spareroom_scrape_runs for select
using (tenant_id = current_tenant_id());
