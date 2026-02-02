create or replace function next_bonus_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
set row_security = off
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
