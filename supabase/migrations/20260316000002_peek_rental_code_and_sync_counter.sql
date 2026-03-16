-- Add a read-only peek function so the form preview doesn't consume a code number.
-- The existing next_rental_code increments on every call, meaning each form load
-- was wasting a counter slot and causing the counter to desync from reality.

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

  -- No row yet → first rental will be CC0001
  if peek_value is null then
    peek_value := 1;
  end if;

  return 'CC' || lpad(peek_value::text, 4, '0');
end;
$$;

-- Re-sync the counter to the highest code already in rental_codes so that
-- the next real submission continues the correct sequence.
insert into tenant_rental_code_counter (tenant_id, current_value)
select
  tenant_id,
  coalesce(max(cast(substring(code from 3) as integer)), 0)
from rental_codes
where code ~ '^CC[0-9]+$'
group by tenant_id
on conflict (tenant_id) do update
  set current_value = excluded.current_value
  where tenant_rental_code_counter.current_value < excluded.current_value;
