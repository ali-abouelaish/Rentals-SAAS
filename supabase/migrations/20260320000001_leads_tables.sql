-- Leads feature: Gmail connections, platform configs, and leads table.

-- One Gmail OAuth connection per tenant
create table if not exists public.tenant_gmail_connections (
  tenant_id      uuid primary key references public.tenants(id) on delete cascade,
  gmail_address  text not null,
  access_token   text not null,
  refresh_token  text not null,
  token_expiry   timestamptz not null,
  history_id     text,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Per-tenant dynamic portal configs (Zoopla, Rightmove, etc.)
create table if not exists public.tenant_platform_configs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  platform_name  text not null,
  sender_domain  text not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (tenant_id, platform_name)
);

create index if not exists idx_tenant_platform_configs_tenant
  on public.tenant_platform_configs (tenant_id, is_active);

-- Inbound leads from property portals
create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  message_id         text not null,
  name               text not null,
  email              text not null,
  telephone          text,
  telephone_clean    text,
  address            text,
  full_address       text,
  property_ref       text,
  property_url       text,
  message_text       text,
  source             text not null,
  status             text not null default 'new'
                       check (status in ('new', 'contacted', 'viewing', 'offer', 'closed')),
  listing_id         uuid references public.scraped_listings(id) on delete set null,
  assigned_to        uuid references public.user_profiles(id) on delete set null,
  is_hot             boolean not null default false,
  has_phone          boolean not null default false,
  raw_body           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, message_id)
);

create index if not exists idx_leads_tenant_status
  on public.leads (tenant_id, status, created_at desc);

create index if not exists idx_leads_tenant_source
  on public.leads (tenant_id, source);

create index if not exists idx_leads_tenant_assigned
  on public.leads (tenant_id, assigned_to);

create index if not exists idx_leads_listing
  on public.leads (listing_id);
