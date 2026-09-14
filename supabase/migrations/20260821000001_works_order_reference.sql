-- Sequential, human-quotable references for work orders (maintenance_jobs).
--
-- Format: WO-00001, per tenant, continuous (never resets by year) so a
-- reference given to a contractor stays unique for the life of the agency.
--
-- Assignment happens in a BEFORE INSERT trigger rather than in application
-- code: work orders are created from the Maintenance page, from ticket
-- promotion, and by the import CLI, and every one of them must get a
-- reference. The counter upsert is atomic, so concurrent inserts serialise
-- on the counter row instead of racing (the ticket-reference code retries on
-- collision because it counts rows; this one cannot collide).

-- ============================================================
-- Counter (mirrors tenant_rental_code_counter)
-- ============================================================

create table if not exists public.tenant_works_order_counter (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  current_value integer not null default 0
);

alter table public.tenant_works_order_counter enable row level security;

-- Writes only ever happen through next_works_order_ref() (security definer),
-- so members need read access alone — enough for the "next reference" preview.
drop policy if exists "tenant_members_select_works_order_counter"
  on public.tenant_works_order_counter;
create policy "tenant_members_select_works_order_counter"
  on public.tenant_works_order_counter for select
  using (tenant_id = (select current_tenant_id()));

-- ============================================================
-- Allocation + preview
-- ============================================================

create or replace function public.next_works_order_ref(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value integer;
begin
  insert into tenant_works_order_counter (tenant_id, current_value)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update
  set current_value = tenant_works_order_counter.current_value + 1
  returning current_value into next_value;

  return 'WO-' || lpad(next_value::text, 5, '0');
end;
$$;

-- Read-only: shows the form what the next reference will be without
-- consuming it (same split as peek_rental_code / next_rental_code).
create or replace function public.peek_works_order_ref(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  peek_value integer;
begin
  select current_value + 1
    into peek_value
    from tenant_works_order_counter
   where tenant_id = p_tenant_id;

  if peek_value is null then
    peek_value := 1;
  end if;

  return 'WO-' || lpad(peek_value::text, 5, '0');
end;
$$;

-- ============================================================
-- Column + backfill
-- ============================================================

alter table public.maintenance_jobs
  add column if not exists reference text;

-- Existing rows get references in creation order, so the sequence reads as a
-- history rather than being assigned at random.
with numbered as (
  select
    id,
    row_number() over (partition by tenant_id order by created_at, id) as seq
  from public.maintenance_jobs
  where reference is null
)
update public.maintenance_jobs j
set reference = 'WO-' || lpad(n.seq::text, 5, '0')
from numbered n
where j.id = n.id;

-- Seed each tenant's counter past whatever the backfill just used.
insert into public.tenant_works_order_counter (tenant_id, current_value)
select
  tenant_id,
  coalesce(max((substring(reference from '^WO-([0-9]+)$'))::integer), 0)
from public.maintenance_jobs
where reference ~ '^WO-[0-9]+$'
group by tenant_id
on conflict (tenant_id) do update
  set current_value = greatest(
    tenant_works_order_counter.current_value,
    excluded.current_value
  );

create unique index if not exists maintenance_jobs_tenant_reference_key
  on public.maintenance_jobs (tenant_id, reference);

alter table public.maintenance_jobs
  alter column reference set not null;

-- ============================================================
-- Trigger
-- ============================================================

create or replace function public.set_works_order_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := next_works_order_ref(new.tenant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_jobs_set_reference on public.maintenance_jobs;
create trigger maintenance_jobs_set_reference
  before insert on public.maintenance_jobs
  for each row
  execute function public.set_works_order_reference();
