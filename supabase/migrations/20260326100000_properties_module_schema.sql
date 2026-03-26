-- Properties Module: Core Schema
-- Creates tables for portfolios, properties, owner_landlords, manager_landlords,
-- property_residents, units, and unit_photos.

-- Portfolios (e.g. FENIX, JMS, Smart Share)
create table if not exists public.portfolios (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create index if not exists portfolios_tenant_id_idx on public.portfolios(tenant_id);

-- Owner landlords (rent-to-rent: person/entity the company pays rent to)
create table if not exists public.owner_landlords (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  name                  text not null,
  phone                 text,
  email                 text,
  contract_start_date   date,
  contract_expiry_date  date,
  monthly_rent_owed     numeric(10,2),
  payment_schedule      text check (payment_schedule in ('monthly','quarterly','biannual','annual')),
  next_payment_due      date,
  contract_document_url text,
  alert_60_days         boolean not null default true,
  alert_30_days         boolean not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists owner_landlords_tenant_id_idx on public.owner_landlords(tenant_id);

-- Manager landlords (clients who manage their own properties via Harbor Ops)
create table if not exists public.manager_landlords (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  full_name    text not null,
  company_name text,
  phone        text,
  email        text,
  address      text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists manager_landlords_tenant_id_idx on public.manager_landlords(tenant_id);

-- Properties (physical buildings/flats at an address)
create table if not exists public.properties (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  portfolio_id        uuid references public.portfolios(id) on delete set null,
  property_type       text not null check (property_type in ('hmo','studio','whole_flat')),
  name                text not null,
  address_line_1      text not null,
  address_line_2      text,
  postcode            text,
  area                text,
  nearest_tube_station text,
  total_rooms         integer,
  total_bathrooms     integer,
  bills               text check (bills in ('all_included','top_up_gas_elec','top_up_elec','top_up_gas')),
  bills_notes         text,
  furnished           boolean not null default true,
  parking             boolean not null default false,
  garden              boolean not null default false,
  broadband           boolean not null default true,
  washing_machine     boolean not null default true,
  dishwasher          boolean not null default false,
  central_heating     boolean not null default true,
  separate_wc         boolean not null default false,
  smoker_ok           boolean not null default false,
  pets_ok             boolean not null default false,
  preferred_occupation text check (preferred_occupation in ('professional','student','any')) default 'any',
  preferred_gender    text check (preferred_gender in ('male','female','any')) default 'any',
  min_age             integer,
  max_age             integer,
  floor_plan_url      text,
  owner_landlord_id   uuid references public.owner_landlords(id) on delete set null,
  manager_landlord_id uuid references public.manager_landlords(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists properties_tenant_id_idx       on public.properties(tenant_id);
create index if not exists properties_portfolio_id_idx    on public.properties(portfolio_id);
create index if not exists properties_area_idx            on public.properties(area);
create index if not exists properties_property_type_idx   on public.properties(property_type);

-- Property residents (the people living in units; named to avoid clash with SaaS 'tenants' table)
create table if not exists public.property_residents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  full_name     text not null,
  phone         text,
  email         text,
  date_of_birth date,
  nationality   text,
  occupation    text,
  created_at    timestamptz not null default now()
);

create index if not exists property_residents_tenant_id_idx on public.property_residents(tenant_id);

-- Units (all lettable units: rooms, studios, whole flats)
create table if not exists public.units (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  property_id      uuid not null references public.properties(id) on delete cascade,
  resident_id      uuid references public.property_residents(id) on delete set null,
  unit_type        text not null check (unit_type in ('room','studio','whole_flat')),
  room_number      text,
  room_type        text check (room_type in ('single','double','master','ensuite')),
  status           text not null default 'available'
                     check (status in ('available','occupied','move_out','booked','on_hold','renewal','replacement')),
  notice_given     boolean not null default false,
  available_date   date,
  min_price_pcm    integer,
  max_price_pcm    integer,
  couples_allowed  boolean not null default false,
  couples_price_pcm integer,
  deposit          integer,
  contract_start_date date,
  contract_end_date   date,
  collection_date  integer check (collection_date between 1 and 31),
  furnishings      text check (furnishings in ('furnished','unfurnished','part_furnished')) default 'furnished',
  drive_folder_url text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists units_tenant_id_idx     on public.units(tenant_id);
create index if not exists units_property_id_idx   on public.units(property_id);
create index if not exists units_status_idx        on public.units(status);
create index if not exists units_available_date_idx on public.units(available_date);
create index if not exists units_resident_id_idx   on public.units(resident_id);

-- Unit photos (both property-level communal photos and unit-level room photos)
create table if not exists public.unit_photos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  unit_id     uuid references public.units(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  url         text not null,
  category    text not null check (category in ('room','bathroom','kitchen','exterior','garden','communal','wc')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists unit_photos_unit_id_idx     on public.unit_photos(unit_id);
create index if not exists unit_photos_property_id_idx on public.unit_photos(property_id);
create index if not exists unit_photos_tenant_id_idx   on public.unit_photos(tenant_id);

-- Enable RLS on all new tables
alter table public.portfolios           enable row level security;
alter table public.owner_landlords      enable row level security;
alter table public.manager_landlords    enable row level security;
alter table public.properties           enable row level security;
alter table public.property_residents   enable row level security;
alter table public.units                enable row level security;
alter table public.unit_photos          enable row level security;
