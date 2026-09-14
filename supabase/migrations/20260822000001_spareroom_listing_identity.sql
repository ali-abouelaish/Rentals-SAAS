-- Stable row identity for SpareRoom listings.
--
-- The scraper used to delete a landlord's rows and re-insert them on every run.
-- Two consequences this migration cleans up so the new upsert-then-sweep write
-- path (scripts/OGSCRPAPER.py) starts from a sane table:
--
--   1. Every run minted new uuids. leads.listing_id references
--      scraped_listings(id) on delete set null, so each nightly run silently
--      severed every SpareRoom lead's link to the listing it came from.
--   2. The delete was scoped to landlords the run could vouch for, but the insert
--      was not, so any landlord whose profile paginated cleanly while one of its
--      listing pages errored got a second copy of its rows. Once per such run,
--      indefinitely.
--
-- The fix is to give each row an external_ref derived from the advert's own id,
-- which the scraper then upserts on. This migration derives that same value for
-- the rows already in the table, collapses the duplicates that (2) created, and
-- repoints affected leads at the surviving row -- so the first run after deploy
-- updates rows in place rather than replacing the whole table one last time.
--
-- The derivation MUST stay in step with spareroom_external_ref() in
-- scripts/OGSCRPAPER.py. If they drift, no existing row matches and every
-- listing is re-created once (losing its lead links) on the next run.
--
-- Scope: source = 'spareroom' only. Spreadsheet-imported rows already carry their
-- own external_ref and are deliberately untouched.

-- ------------------------------------------------------------
-- 1. Derive the ref for every existing SpareRoom row
-- ------------------------------------------------------------
-- Both advert URL shapes carry the same id:
--   /flatshare/flatshare_detail.pl?flatshare_id=18333812&...  -> spareroom:18333812
--   /flatshare/london/camden/18333812                         -> spareroom:18333812
-- The rest of the query string (search_id, search_results, city_id) changes run
-- to run, which is exactly why the id and not the URL is the identity.
--
-- The "spareroom:" prefix matters: uniq_scraped_listings_landlord_ref spans all
-- sources, so an unprefixed id or a bare URL could collide with a row imported
-- from the same landlord's spreadsheet and let one source overwrite the other.
-- Session-scoped, not `on commit drop`: these migrations get applied by hand as
-- often as by the CLI, and outside a transaction block `on commit drop` would
-- take the table away before the next statement could read it.
drop table if exists spareroom_ref_map;
create temporary table spareroom_ref_map as
select
  s.id,
  s.landlord_id,
  -- Precomputed rather than referenced from the window ORDER BY below, where a
  -- correlated subquery is not something Postgres will plan.
  exists (select 1 from public.leads l where l.listing_id = s.id) as has_lead,
  coalesce(
    'spareroom:' || substring(s.url from '[?&]flatshare_id=([0-9]+)'),
    'spareroom:' || substring(split_part(split_part(s.url, '#', 1), '?', 1)
                              from '/([0-9]+)/?$'),
    'spareroom:url:' || s.url
  ) as ref,
  s.created_at,
  s.last_seen_at
from public.scraped_listings s
where s.source = 'spareroom'
  and s.landlord_id is not null
  and s.url is not null;

-- Rows with no landlord_id or no url are left alone here. They cannot be matched
-- by the upsert and cannot be reached by the landlord-scoped sweep either; the
-- scraper's guarded orphan sweep is what clears them, on a run healthy enough to
-- prove they are unreachable rather than merely unread.

-- ------------------------------------------------------------
-- 2. Pick a survivor per (landlord, advert)
-- ------------------------------------------------------------
-- Preference order, and why:
--   a row a lead already points at  -- keeping it preserves a real link
--   most recently seen / created    -- the freshest scrape of the advert
--   id                              -- a total order, so the result is stable
drop table if exists spareroom_ref_ranked;
create temporary table spareroom_ref_ranked as
select
  m.id,
  m.landlord_id,
  m.ref,
  row_number() over w as rn,
  first_value(m.id) over w as keeper_id
from spareroom_ref_map m
window w as (
  partition by m.landlord_id, m.ref
  order by
    m.has_lead desc,
    coalesce(m.last_seen_at, m.created_at) desc,
    m.created_at desc,
    m.id
);

-- ------------------------------------------------------------
-- 3. Repoint leads off the duplicates before deleting them
-- ------------------------------------------------------------
-- Done first and explicitly: the FK is `on delete set null`, so deleting a
-- duplicate a lead points at would quietly null the link instead of moving it to
-- the identical surviving row.
update public.leads l
   set listing_id = r.keeper_id,
       updated_at = now()
  from spareroom_ref_ranked r
 where l.listing_id = r.id
   and r.rn > 1
   and r.keeper_id is distinct from r.id;

-- ------------------------------------------------------------
-- 4. Drop the duplicates
-- ------------------------------------------------------------
delete from public.scraped_listings s
 using spareroom_ref_ranked r
 where s.id = r.id
   and r.rn > 1;

-- ------------------------------------------------------------
-- 5. Stamp the survivors
-- ------------------------------------------------------------
-- The `not exists` guard is belt and braces against the one collision the
-- namespacing does not rule out by construction: a spreadsheet row for the same
-- landlord whose own external_ref happens to be this exact string. Such a row
-- keeps a null ref, which costs it one re-create on the next run rather than
-- failing the whole migration.
update public.scraped_listings s
   set external_ref = r.ref,
       updated_at = now()
  from spareroom_ref_ranked r
 where s.id = r.id
   and r.rn = 1
   and s.external_ref is distinct from r.ref
   and not exists (
     select 1
       from public.scraped_listings other
      where other.landlord_id = r.landlord_id
        and other.external_ref = r.ref
        and other.id <> s.id
   );

-- ------------------------------------------------------------
-- 6. The conflict target the scraper upserts on
-- ------------------------------------------------------------
-- Re-asserted here (created by 20260729000001) so this migration is
-- self-sufficient: without this index `on conflict (landlord_id, external_ref)`
-- has nothing to infer and every scraper run fails outright.
create unique index if not exists uniq_scraped_listings_landlord_ref
  on public.scraped_listings(landlord_id, external_ref);

drop table if exists spareroom_ref_ranked;
drop table if exists spareroom_ref_map;

comment on column public.scraped_listings.external_ref is
  'Stable per-landlord row identity, upserted on. Spreadsheet rows use the sheet''s own reference; SpareRoom rows use ''spareroom:<advert id>'' (namespaced so the two sources cannot collide on the shared uniqueness constraint).';

-- RLS: no new tables and no policy surface change -- scraped_listings and leads
-- both already have row level security enabled with tenant-scoped policies.
