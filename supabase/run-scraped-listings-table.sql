-- Run in Supabase Dashboard SQL Editor if migrations are not applied via CLI.
-- Creates scraped_listings table with tenant_id and full scraper columns.

create table if not exists scraped_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  url text,
  title text,
  landlord_id uuid references landlords(id) on delete set null,
  location text,
  latitude numeric,
  longitude numeric,
  status text,
  price numeric,
  description text,
  property_type text,
  available_date date,
  min_term text,
  max_term text,
  deposit numeric,
  bills_included text,
  furnishings text,
  parking text,
  garden text,
  broadband text,
  housemates text,
  total_rooms text,
  smoker text,
  pets text,
  occupation text,
  gender text,
  couples_ok text,
  smoking_ok text,
  pets_ok text,
  pref_occupation text,
  "references" text,
  min_age text,
  max_age text,
  photo_count int,
  first_photo_url text,
  all_photos text,
  photos text,
  paying text,
  flag text,
  room_count int,
  min_room_price_pcm numeric,
  max_room_price_pcm numeric,
  room1_type text,
  room1_price_pcm numeric,
  room1_deposit numeric,
  room2_type text,
  room2_price_pcm numeric,
  room2_deposit numeric,
  room3_type text,
  room3_price_pcm numeric,
  room3_deposit numeric,
  room4_type text,
  room4_price_pcm numeric,
  room4_deposit numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scraped_listings_tenant on scraped_listings(tenant_id);
create index if not exists idx_scraped_listings_landlord on scraped_listings(landlord_id);
create index if not exists idx_scraped_listings_url on scraped_listings(url);
create index if not exists idx_scraped_listings_status on scraped_listings(status);

alter table scraped_listings enable row level security;

drop policy if exists "scraped_listings select" on scraped_listings;
drop policy if exists "scraped_listings insert" on scraped_listings;
drop policy if exists "scraped_listings update" on scraped_listings;
drop policy if exists "scraped_listings delete" on scraped_listings;

create policy "scraped_listings select"
on scraped_listings for select
using (tenant_id = current_tenant_id());

create policy "scraped_listings insert"
on scraped_listings for insert
with check (tenant_id = current_tenant_id());

create policy "scraped_listings update"
on scraped_listings for update
using (tenant_id = current_tenant_id())
with check (tenant_id = current_tenant_id());

create policy "scraped_listings delete"
on scraped_listings for delete
using (tenant_id = current_tenant_id());
