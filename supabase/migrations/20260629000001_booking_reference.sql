-- Add a human-readable booking reference (e.g. BK-7F3K2) so staff can track a
-- booking by its number across forms, responses, status and contracts.
--
-- The reference is RANDOM (not a sequential counter) on purpose: a sequential
-- code would leak how many bookings an agency has. 5 chars from a 30-symbol
-- unambiguous alphabet (no 0/O/1/I/L/U) ≈ 24M combinations per tenant.

alter table public.bookings add column if not exists booking_reference text;

-- Backfill existing rows with unique random codes (unique within each tenant).
do $$
declare
  b record;
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i int;
begin
  for b in select id, tenant_id from public.bookings where booking_reference is null loop
    loop
      candidate := 'BK-';
      for i in 1..5 loop
        candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (
        select 1 from public.bookings
        where tenant_id = b.tenant_id and booking_reference = candidate
      );
    end loop;
    update public.bookings set booking_reference = candidate where id = b.id;
  end loop;
end $$;

-- Enforce per-tenant uniqueness going forward (the app retries on collision).
create unique index if not exists bookings_tenant_reference_uniq
  on public.bookings (tenant_id, booking_reference);
