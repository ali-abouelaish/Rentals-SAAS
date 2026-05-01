-- Add geolocation columns to market_listings so the AI route can filter
-- listings by true Haversine distance from the input postcode (more accurate
-- than relying on SpareRoom's postcode-centroid radius search).

alter table market_listings
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

create index if not exists idx_market_listings_lat_lon
  on market_listings(latitude, longitude)
  where latitude is not null and longitude is not null;
