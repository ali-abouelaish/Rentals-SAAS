-- Unique bank standing-order payment reference per contract.
-- Renters put this reference on their standing order so incoming bank lines
-- can be matched back to a tenancy automatically (future reconciliation
-- feature). Globally unique because a bank statement line only carries the
-- reference, not the agency.

-- Unambiguous alphabet (no 0/O/1/I/L) so renters can type it into banking
-- apps without transcription errors. 8 chars over 31 symbols ~ 8.5e11 space.
create or replace function public.generate_contract_payment_reference()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  ref text;
begin
  loop
    ref := 'RP-';
    for i in 1..8 loop
      ref := ref || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.property_contracts where payment_reference = ref
    );
  end loop;
  return ref;
end;
$$;

alter table public.property_contracts
  add column if not exists payment_reference text;

update public.property_contracts
  set payment_reference = public.generate_contract_payment_reference()
  where payment_reference is null;

alter table public.property_contracts
  alter column payment_reference set not null,
  alter column payment_reference set default public.generate_contract_payment_reference();

create unique index if not exists uq_property_contracts_payment_reference
  on public.property_contracts (payment_reference);
