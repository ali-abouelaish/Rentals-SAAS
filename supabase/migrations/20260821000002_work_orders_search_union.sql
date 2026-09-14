-- ============================================================
-- Add `work_order` (maintenance_jobs) to the global_search RPC union.
-- ============================================================
-- Work orders became findable by their sequential reference in
-- 20260821000001_works_order_reference.sql; this makes that reference
-- reachable from the global Cmd+K bar as well as the Maintenance page.
--
-- Rebuilt in full from 20260730000004_owners_search_union.sql plus one
-- new branch -- the function is replaced wholesale each time a kind is
-- added.
-- ============================================================

-- Search vector. Weighted so the reference and title win over the free-text
-- description; assigned_to lets you find "everything with Ace Plumbing on it".
alter table public.maintenance_jobs
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(reference, '')), 'A') ||
    setweight(
      to_tsvector('simple', coalesce(regexp_replace(reference, '[^A-Za-z0-9]', '', 'g'), '')),
      'A'
    ) ||
    setweight(
      to_tsvector('simple', coalesce(ltrim(regexp_replace(reference, '^[A-Za-z-]+', ''), '0'), '')),
      'B'
    ) ||
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(assigned_to, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(reported_by, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored;

create index if not exists maintenance_jobs_search_vector_idx
  on public.maintenance_jobs using gin (search_vector);

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

    -- Units
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

    -- PM tenants
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

    -- Contracts
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

    -- Property owners (PM) — subtitle prefers contact details, then
    -- falls back to how many properties they own so the row is never
    -- bare next to an identically-named RA landlord.
    select
      'owner'::text                           as kind,
      o.id                                    as id,
      null::uuid                              as parent_id,
      o.name                                  as title,
      coalesce(
        nullif(o.email, ''),
        nullif(o.phone, ''),
        (
          select case count(*)
                   when 0 then null
                   when 1 then '1 property'
                   else count(*) || ' properties'
                 end
            from public.properties pr
           where pr.owner_landlord_id = o.id
        )
      )                                       as subtitle,
      ts_rank(o.search_vector, parsed.tsq) * 1.1 as rank
    from public.owner_landlords o, parsed
    where o.tenant_id = t
      and o.search_vector @@ parsed.tsq

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

    union all

    -- Keys: parent_id = property_id so the UI can route into the
    -- property page's Keys tab. Falls back to the parent of the unit
    -- when the key is unit-scoped (still a property route, just with
    -- a unit-level label).
    select
      'key'::text                                              as kind,
      k.id                                                     as id,
      coalesce(k.property_id, u.property_id)                   as parent_id,
      k.set_name || ' · ' || k.copy_label                      as title,
      coalesce(p.address_line_1, pu.address_line_1)            as subtitle,
      ts_rank(k.search_vector, parsed.tsq) * 0.9               as rank
    from public.keys k
    left join public.units u      on u.id  = k.unit_id
    left join public.properties p on p.id  = k.property_id
    left join public.properties pu on pu.id = u.property_id
    cross join parsed
    where k.tenant_id = t
      and k.search_vector @@ parsed.tsq

    union all

    -- Preferred suppliers (maintenance directory)
    select
      'supplier'::text                        as kind,
      s.id                                    as id,
      null::uuid                              as parent_id,
      s.name                                  as title,
      coalesce(s.contact_name, s.email, s.phone) as subtitle,
      ts_rank(s.search_vector, parsed.tsq)    as rank
    from public.maintenance_suppliers s, parsed
    where s.tenant_id = t
      and s.search_vector @@ parsed.tsq

    union all

    -- Compliance certificates: parent_id = property_id so the UI can
    -- route to the property's Certificates tab.
    select
      'certificate'::text                     as kind,
      ce.id                                   as id,
      ce.property_id                          as parent_id,
      case ce.type
        when 'gas_safety'         then 'Gas Safety (CP12)'
        when 'eicr'               then 'EICR'
        when 'epc'                then 'EPC'
        when 'fire_alarm'         then 'Fire Alarm'
        when 'emergency_lighting' then 'Emergency Lighting'
        when 'legionella'         then 'Legionella Risk Assessment'
        when 'pat'                then 'PAT'
        when 'hmo_licence'        then 'HMO Licence'
        else initcap(replace(ce.type, '_', ' '))
      end
        || coalesce(' · ' || nullif(ce.reference, ''), '') as title,
      p.address_line_1                        as subtitle,
      ts_rank(ce.search_vector, parsed.tsq)   as rank
    from public.certificates ce
    join public.properties p on p.id = ce.property_id
    cross join parsed
    where ce.tenant_id = t
      and ce.search_vector @@ parsed.tsq
    union all

    -- Work orders (maintenance_jobs). Reference is indexed three ways in the
    -- search vector -- raw ("wo-00042"), squashed ("wo00042") and unpadded
    -- ("42") -- because parseSearchQuery strips punctuation inside a term, so
    -- a user typing "WO-00042" arrives here as "wo00042:*".
    select
      'work_order'::text                      as kind,
      j.id                                    as id,
      null::uuid                              as parent_id,
      j.reference || ' · ' || j.title         as title,
      nullif(
        concat_ws(
          ' · ',
          coalesce(p.address_line_1, p.name),
          initcap(replace(j.status::text, '_', ' '))
        ),
        ''
      )                                       as subtitle,
      ts_rank(j.search_vector, parsed.tsq)    as rank
    from public.maintenance_jobs j
    join public.properties p on p.id = j.property_id
    cross join parsed
    where j.tenant_id = t
      and j.search_vector @@ parsed.tsq

  ) results
  order by rank desc, kind asc
  limit lim;
$$;

grant execute on function public.global_search(text, uuid, integer) to authenticated;
