-- ============================================================
-- Global Search (Cmd+K) — Postgres FTS infrastructure
-- ============================================================
-- Adds GIN-indexed search_vector columns to the searchable tables
-- and exposes a single tenant-scoped RPC `global_search` that
-- unions matches across all of them and returns rank-ordered rows.
--
-- v1 covers: properties, units, pm_tenants, property_contracts,
-- landlords (RA), clients (RA). Owner/manager landlords are
-- omitted because they have no detail page to navigate to yet.
--
-- Postgres ≥ 12 required (Supabase is fine). Generated stored
-- columns keep the vector in sync without triggers.
-- ============================================================

-- ─── properties ────────────────────────────────────────────
alter table public.properties
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(address_line_1, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(postcode, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(address_line_2, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(area, '')), 'C')
  ) stored;

create index if not exists properties_search_vector_idx
  on public.properties using gin (search_vector);

-- ─── units ─────────────────────────────────────────────────
alter table public.units
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(room_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(room_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(unit_type, '')), 'C')
  ) stored;

create index if not exists units_search_vector_idx
  on public.units using gin (search_vector);

-- ─── pm_tenants ────────────────────────────────────────────
alter table public.pm_tenants
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(full_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(employer_name, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(current_address, '')), 'C')
  ) stored;

create index if not exists pm_tenants_search_vector_idx
  on public.pm_tenants using gin (search_vector);

-- ─── property_contracts ───────────────────────────────────
-- Limited search surface in v1 (no reference column). Notes only.
alter table public.property_contracts
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(notes, '')), 'B')
  ) stored;

create index if not exists property_contracts_search_vector_idx
  on public.property_contracts using gin (search_vector);

-- ─── landlords (RA module) ────────────────────────────────
alter table public.landlords
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(contact, '')), 'B')
  ) stored;

create index if not exists landlords_search_vector_idx
  on public.landlords using gin (search_vector);

-- ─── clients (RA module) ──────────────────────────────────
-- Note: clients.full_name is itself a generated column (first_name ||
-- ' ' || last_name), and Postgres forbids one generated column from
-- referencing another. We index the underlying first_name + last_name
-- directly, which gives the same searchable surface.
alter table public.clients
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(current_address, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(occupation, '')), 'C')
  ) stored;

create index if not exists clients_search_vector_idx
  on public.clients using gin (search_vector);

-- ============================================================
-- RPC: global_search(q, t, lim)
-- ============================================================
-- `q` is a pre-parsed tsquery string (e.g. 'albert:* & road:*').
-- `t` is the tenant_id to scope to. Every UNION arm filters by it
--   so cross-tenant leakage is impossible regardless of RLS.
-- `lim` caps the total number of rows returned.
--
-- security invoker so RLS still applies as a second line of defence.
-- ============================================================

create or replace function public.global_search(
  q text,
  t uuid,
  lim integer default 20
)
returns table (
  kind      text,
  id        uuid,
  parent_id uuid,
  title     text,
  subtitle  text,
  rank      real
)
language sql
stable
security invoker
as $$
  with parsed as (
    select to_tsquery('simple', q) as tsq
  )
  select * from (
    -- Properties
    select
      'property'::text                        as kind,
      p.id                                    as id,
      null::uuid                              as parent_id,
      coalesce(p.address_line_1, p.name)      as title,
      nullif(coalesce(p.postcode, p.area, ''), '') as subtitle,
      ts_rank(p.search_vector, parsed.tsq) * 1.5 as rank
    from public.properties p, parsed
    where p.tenant_id = t
      and p.search_vector @@ parsed.tsq

    union all

    -- Units (parent_id = property_id so the UI can route to the property page)
    select
      'unit'::text                            as kind,
      u.id                                    as id,
      u.property_id                           as parent_id,
      case
        when u.room_number is not null then 'Room ' || u.room_number
        else initcap(replace(u.unit_type, '_', ' '))
      end                                     as title,
      p.address_line_1                        as subtitle,
      ts_rank(u.search_vector, parsed.tsq)    as rank
    from public.units u
    join public.properties p on p.id = u.property_id
    cross join parsed
    where u.tenant_id = t
      and u.search_vector @@ parsed.tsq

    union all

    -- PM tenants (subtitle: their current property if any, else email)
    select
      'pm_tenant'::text                       as kind,
      pt.id                                   as id,
      null::uuid                              as parent_id,
      pt.full_name                            as title,
      coalesce(
        (
          select pp.address_line_1
            from public.units uu
            join public.properties pp on pp.id = uu.property_id
           where uu.pm_tenant_id = pt.id
           limit 1
        ),
        pt.email
      )                                       as subtitle,
      ts_rank(pt.search_vector, parsed.tsq) * 1.2 as rank
    from public.pm_tenants pt, parsed
    where pt.tenant_id = t
      and pt.search_vector @@ parsed.tsq

    union all

    -- Contracts (title: tenant name, subtitle: property address)
    select
      'contract'::text                        as kind,
      c.id                                    as id,
      c.unit_id                               as parent_id,
      pt.full_name                            as title,
      p.address_line_1                        as subtitle,
      ts_rank(c.search_vector, parsed.tsq)    as rank
    from public.property_contracts c
    join public.pm_tenants pt on pt.id = c.pm_tenant_id
    join public.units u       on u.id  = c.unit_id
    join public.properties p  on p.id  = u.property_id
    cross join parsed
    where c.tenant_id = t
      and c.search_vector @@ parsed.tsq

    union all

    -- Landlords (RA)
    select
      'landlord'::text                        as kind,
      l.id                                    as id,
      null::uuid                              as parent_id,
      l.name                                  as title,
      coalesce(l.email, l.contact)            as subtitle,
      ts_rank(l.search_vector, parsed.tsq) * 1.1 as rank
    from public.landlords l, parsed
    where l.tenant_id = t
      and l.search_vector @@ parsed.tsq

    union all

    -- Clients (RA)
    select
      'client'::text                          as kind,
      cl.id                                   as id,
      null::uuid                              as parent_id,
      cl.full_name                            as title,
      coalesce(cl.email, cl.phone)            as subtitle,
      ts_rank(cl.search_vector, parsed.tsq) * 1.2 as rank
    from public.clients cl, parsed
    where cl.tenant_id = t
      and cl.search_vector @@ parsed.tsq
  ) results
  order by rank desc, kind asc
  limit lim;
$$;

-- Authenticated users can call the RPC; row access still goes through RLS.
grant execute on function public.global_search(text, uuid, integer) to authenticated;
