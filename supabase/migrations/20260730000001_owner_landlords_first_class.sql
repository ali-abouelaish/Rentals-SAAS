-- ============================================================
-- Promote owner_landlords to a first-class record.
-- ============================================================
-- Until now a property owner could only be created/edited through
-- an inline dialog on the property form, so the table carried the
-- bare minimum. Owners now get their own section (/owners) with a
-- detail page, statements and search, which needs a postal address
-- (statements are addressed to it), free-text notes, an updated_at
-- for the touch trigger every other module has, and a search vector.
--
-- NOTE: this is the PROPERTY-MANAGEMENT owner, not the rental-agency
-- `landlords` table. The two are deliberately unrelated.
-- ============================================================

alter table public.owner_landlords
  add column if not exists address    text,
  add column if not exists notes      text,
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger owner_landlords_touch_updated_at
  before update on public.owner_landlords
  for each row execute function public.set_updated_at();

-- ─── Global search ─────────────────────────────────────────
-- Weighted like the other searchable entities: identity first,
-- contact details second, free text last.
alter table public.owner_landlords
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(address, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'D')
  ) stored;

create index if not exists owner_landlords_search_vector_idx
  on public.owner_landlords using gin (search_vector);

-- Owner list/detail pages always filter by tenant then sort by name.
create index if not exists owner_landlords_tenant_name_idx
  on public.owner_landlords (tenant_id, name);
