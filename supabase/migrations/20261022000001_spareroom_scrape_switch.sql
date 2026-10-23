-- Agency-wide switch: include this agency in the daily SpareRoom scrape.
--
-- On (the default, and how every agency has worked so far): the 09:00 job
-- (src/lib/cron/spareroomScraper.ts) reads every landlord with a SpareRoom
-- profile URL. Off: the job skips the agency entirely — the script is never
-- spawned for it, so nothing is written and nothing is swept. Existing listings
-- are kept exactly as they were and simply age (turning stale after 7 days).
-- The on-demand "Run scraper" button on a landlord still works either way.
--
-- Existing rows default to true, which is exactly today's behaviour.

alter table public.tenants
  add column if not exists spareroom_scrape_enabled boolean not null default true;

comment on column public.tenants.spareroom_scrape_enabled is
  'Whether the daily SpareRoom scrape runs for this agency. Off pauses the schedule only; on-demand runs still work.';
