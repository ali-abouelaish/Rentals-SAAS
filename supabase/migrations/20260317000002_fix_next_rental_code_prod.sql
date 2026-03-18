-- Recreate next_rental_code and peek_rental_code to ensure production has
-- the correct implementation using tenant_rental_code_counter (not the old
-- "rentals" table that no longer exists).

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

create or replace function peek_rental_code(p_tenant_id uuid)
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
    from tenant_rental_code_counter
   where tenant_id = p_tenant_id;

  if peek_value is null then
    peek_value := 1;
  end if;

  return 'CC' || lpad(peek_value::text, 4, '0');
end;
$$;
