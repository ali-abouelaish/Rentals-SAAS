-- ============================================================
-- Add `keys` to the global_search RPC union.
-- ============================================================
-- Reuses the search_vector already defined on public.keys
-- (migration 20260425000004). Each key is searchable by
-- set_name, copy_label, and notes; matches surface as a 'key'
-- result kind that links back to the parent property.
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
  ) results
  order by rank desc, kind asc
  limit lim;
$$;

grant execute on function public.global_search(text, uuid, integer) to authenticated;
