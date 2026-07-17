-- Per-tenancy standing-order reference for EXACT bank-statement reconciliation.
--
-- Each property_contracts row gets a unique, human-recognisable reference the
-- renter puts on their standing order, e.g. MAPL-SMITH-7K9Q =
--   PROP4  first 4 alphanumerics of the property name (fallback: unit room no.)
--   SURNM5 first 5 letters of the tenant's surname
--   CODE4  4 chars from an unambiguous alphabet (no 0/O/1/I/L/U)
-- The CODE guarantees per-tenant uniqueness; PROP/SURNAME are cosmetic. Fixed
-- segment caps keep the whole reference <= 15 chars, safely inside the 18-char
-- UK Faster-Payments / standing-order reference limit. The matcher normalises
-- away the hyphens, so a bank that strips them still reconciles.

alter table public.property_contracts
  add column if not exists standing_order_ref text;

-- Builds a unique reference for a tenancy. SECURITY DEFINER (like next_rental_code)
-- so the units/properties/pm_tenants lookups aren't blocked by the caller's RLS.
create or replace function public.generate_standing_order_ref(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_pm_tenant_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_prop text;
  v_room text;
  v_full text;
  prop_seg text;
  surname_seg text;
  code text;
  candidate text;
  i int;
begin
  -- Property name for the human-readable prefix (fallback: unit room number).
  select p.name, u.room_number
    into v_prop, v_room
    from public.units u
    left join public.properties p on p.id = u.property_id
   where u.id = p_unit_id;

  -- Tenant surname = last whitespace-delimited token of the full name.
  select full_name
    into v_full
    from public.pm_tenants
   where id = p_pm_tenant_id;

  prop_seg := upper(substr(
    regexp_replace(coalesce(nullif(v_prop, ''), v_room, ''), '[^A-Za-z0-9]', '', 'g'), 1, 4));
  surname_seg := upper(substr(
    regexp_replace(regexp_replace(coalesce(v_full, ''), '^.*\s', ''), '[^A-Za-z]', '', 'g'), 1, 5));

  -- Retry the random code until the whole reference is unique within the tenant.
  loop
    code := '';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    -- concat_ws skips empty descriptive segments, so the code is always present.
    candidate := concat_ws('-', nullif(prop_seg, ''), nullif(surname_seg, ''), code);

    exit when not exists (
      select 1 from public.property_contracts
       where tenant_id = p_tenant_id and standing_order_ref = candidate
    );
  end loop;

  return candidate;
end;
$$;

-- Assign a reference on insert from ANY code path (createContract server action,
-- the import/ CLI, future paths) unless one was supplied explicitly.
create or replace function public.assign_standing_order_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.standing_order_ref is null or new.standing_order_ref = '' then
    new.standing_order_ref := public.generate_standing_order_ref(
      new.tenant_id, new.unit_id, new.pm_tenant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_standing_order_ref on public.property_contracts;
create trigger trg_assign_standing_order_ref
  before insert on public.property_contracts
  for each row execute function public.assign_standing_order_ref();

-- Backfill existing tenancies (uses the same generator; unique within tenant).
do $$
declare c record;
begin
  for c in
    select id, tenant_id, unit_id, pm_tenant_id
      from public.property_contracts
     where standing_order_ref is null
  loop
    update public.property_contracts
       set standing_order_ref =
             public.generate_standing_order_ref(c.tenant_id, c.unit_id, c.pm_tenant_id)
     where id = c.id;
  end loop;
end $$;

-- Per-tenant uniqueness backstop; the generator loop handles the normal case.
create unique index if not exists property_contracts_tenant_so_ref_uniq
  on public.property_contracts (tenant_id, standing_order_ref);
