create table if not exists tenant_bonus_counter (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  current_value integer not null default 0
);

create or replace function next_bonus_code(p_tenant_id uuid)
returns text
language plpgsql
as $$
declare
  next_value integer;
begin
  insert into tenant_bonus_counter(tenant_id, current_value)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update
  set current_value = tenant_bonus_counter.current_value + 1
  returning current_value into next_value;

  return 'LC' || lpad(next_value::text, 4, '0');
end;
$$;

alter table tenant_bonus_counter enable row level security;

drop policy if exists "tenant bonus counter select" on tenant_bonus_counter;
drop policy if exists "tenant bonus counter modify" on tenant_bonus_counter;

create policy "tenant bonus counter select"
on tenant_bonus_counter for select
using (tenant_id = current_tenant_id());

create policy "tenant bonus counter modify"
on tenant_bonus_counter for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());
