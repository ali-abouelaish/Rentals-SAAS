create or replace function next_invoice_number(p_tenant_id uuid)
returns text
language plpgsql
as $$
declare
  next_value integer;
begin
  insert into tenant_invoice_counter(tenant_id, current_value)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update
  set current_value = tenant_invoice_counter.current_value + 1
  returning current_value into next_value;

  return 'INV-' || lpad(next_value::text, 6, '0');
end;
$$;
