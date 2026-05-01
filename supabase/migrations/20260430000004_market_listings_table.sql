-- Market listings: SpareRoom search results scraped by postcode + radius.
-- Shared across tenants (market data is not tenant-specific).
-- Populated by scripts/MARKET_SCRAPER.py via the service role.
-- One row per listing URL; last-write wins on postcode_searched.

create table if not exists market_listings (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  description text,
  location_text text,
  postcode_searched text not null,
  radius_miles_searched numeric,
  postcode_outward text,
  property_type text,
  status text,
  price numeric,
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
  source_search_url text,
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_listings_postcode_searched on market_listings(postcode_searched);
create index if not exists idx_market_listings_postcode_outward on market_listings(postcode_outward);
create index if not exists idx_market_listings_property_type on market_listings(property_type);
create index if not exists idx_market_listings_scraped_at on market_listings(scraped_at desc);

alter table market_listings enable row level security;

-- Any authenticated user can read market data (it's not tenant-specific).
create policy "market_listings select authenticated"
on market_listings for select
to authenticated
using (true);

-- Writes only via service role (scraper). No insert/update/delete policy for
-- regular users — service role bypasses RLS.
