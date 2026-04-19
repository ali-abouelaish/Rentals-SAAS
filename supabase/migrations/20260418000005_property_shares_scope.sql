-- Property Shares: scope by portfolio or specific properties
-- Adds optional scoping to property_shares so admins can narrow the share to:
--   (a) a single portfolio, or
--   (b) a curated list of properties, or
--   (c) all properties in the tenant (both columns NULL — existing behaviour).
--
-- portfolio_id and property_ids are mutually exclusive.

alter table public.property_shares
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null,
  add column if not exists property_ids uuid[];

-- Enforce mutual exclusivity. Both NULL means "all properties" (pre-existing behaviour).
alter table public.property_shares
  drop constraint if exists property_shares_scope_exclusive;

alter table public.property_shares
  add constraint property_shares_scope_exclusive
  check (
    (portfolio_id is null)
    or (property_ids is null)
  );

-- When property_ids is set, it must be non-empty.
alter table public.property_shares
  drop constraint if exists property_shares_property_ids_nonempty;

alter table public.property_shares
  add constraint property_shares_property_ids_nonempty
  check (
    property_ids is null
    or array_length(property_ids, 1) >= 1
  );

create index if not exists property_shares_portfolio_id_idx
  on public.property_shares (portfolio_id);

create index if not exists property_shares_property_ids_gin_idx
  on public.property_shares using gin (property_ids);
