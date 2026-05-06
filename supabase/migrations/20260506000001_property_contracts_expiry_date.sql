-- Optional fixed-term expiry date for property contracts.
-- Most contracts remain periodic/rolling (Renters Rights Act 2025) and leave
-- this null; fixed-term agreements can record their planned end date here.
alter table public.property_contracts
  add column if not exists expiry_date date;

alter table public.property_contracts
  drop constraint if exists property_contracts_expiry_after_start;

alter table public.property_contracts
  add constraint property_contracts_expiry_after_start
    check (expiry_date is null or expiry_date >= start_date);
