-- Import reference columns for the AP Real Estate / Horizon Dreams portfolio import.
-- Nullable text key carried by the import pipeline (import/run.mjs) so reruns match
-- rows exactly instead of relying on natural-key fuzzy matching every time.
-- Unique per tenant where set; existing rows keep NULL until the importer backfills
-- them on a confident natural-key match.

alter table public.portfolios          add column if not exists import_ref text;
alter table public.properties          add column if not exists import_ref text;
alter table public.units               add column if not exists import_ref text;
alter table public.pm_tenants          add column if not exists import_ref text;
alter table public.property_contracts  add column if not exists import_ref text;
alter table public.keys                add column if not exists import_ref text;

create unique index if not exists portfolios_import_ref_unique
  on public.portfolios (tenant_id, import_ref) where import_ref is not null;
create unique index if not exists properties_import_ref_unique
  on public.properties (tenant_id, import_ref) where import_ref is not null;
create unique index if not exists units_import_ref_unique
  on public.units (tenant_id, import_ref) where import_ref is not null;
create unique index if not exists pm_tenants_import_ref_unique
  on public.pm_tenants (tenant_id, import_ref) where import_ref is not null;
create unique index if not exists property_contracts_import_ref_unique
  on public.property_contracts (tenant_id, import_ref) where import_ref is not null;
create unique index if not exists keys_import_ref_unique
  on public.keys (tenant_id, import_ref) where import_ref is not null;
