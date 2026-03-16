-- Fix next_rental_code to run as security definer so it always has
-- permission to upsert the counter regardless of calling user's RLS context.
create or replace function next_rental_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value integer;
begin
  insert into tenant_rental_code_counter(tenant_id, current_value)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update
  set current_value = tenant_rental_code_counter.current_value + 1
  returning current_value into next_value;

  return 'CC' || lpad(next_value::text, 4, '0');
end;
$$;
