-- Organizations (tenants) table
-- Allows mapping subdomains (slugs) like "truehold" to a concrete organization row.

-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Explicit unique index on slug (backed by the unique constraint)
create unique index if not exists organizations_slug_key
  on public.organizations (slug);

