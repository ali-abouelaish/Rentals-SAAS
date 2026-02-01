create extension if not exists "pgcrypto";

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  role text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists agent_profiles (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  avatar_url text,
  commission_percent numeric not null default 0,
  marketing_fee numeric not null default 0,
  role_flags jsonb not null default '{"is_agent": true, "is_marketing": false}',
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  full_name text not null,
  dob text,
  phone text not null,
  email text,
  nationality text,
  current_address text,
  company_name text,
  company_address text,
  occupation text,
  status text not null default 'pending',
  assigned_agent_id uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists landlords (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  contact text,
  billing_address text,
  email text,
  spareroom_profile_url text,
  pays_commission boolean not null default true,
  commission_amount_gbp numeric(12,2) not null default 0,
  commission_term_text text,
  we_do_viewing boolean not null default true,
  profile_notes text,
  created_at timestamptz not null default now()
);

create table if not exists rental_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  landlord_id uuid references landlords(id),
  code text not null,
  date timestamptz not null default now(),
  consultation_fee_amount numeric not null default 0,
  payment_method text not null,
  property_address text not null,
  licensor_name text not null,
  assisted_by_agent_id uuid not null references user_profiles(id),
  marketing_agent_id uuid references user_profiles(id),
  marketing_fee_override_gbp numeric(12,2),
  marketing_fee_override_reason text,
  status text not null default 'pending',
  client_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists listings_scraped (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  landlord_id uuid not null references landlords(id) on delete cascade,
  source text not null,
  listing_url text not null,
  title text,
  price numeric,
  postcode text,
  available_date date,
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists bonuses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  landlord_id uuid not null references landlords(id) on delete cascade,
  amount_owed numeric not null,
  agent_id uuid not null references user_profiles(id),
  payout_mode text not null default 'standard',
  status text not null default 'pending',
  invoice_pending boolean not null default true,
  approved_at timestamptz,
  approved_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists document_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rental_code_id uuid not null references rental_codes(id) on delete cascade,
  set_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_set_id uuid not null references document_sets(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null check (type in ('rental_net','agent_earning','marketing_fee','bonus','refund','adjustment')),
  reference_type text not null,
  reference_id uuid not null,
  amount_gbp numeric not null,
  agent_earning_gbp numeric not null default 0,
  agent_id uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_user_id uuid references user_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tenant_rental_code_counter (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  current_value integer not null default 0
);

create or replace function next_rental_code(p_tenant_id uuid)
returns text
language plpgsql
as $$
declare
  next_value integer;
begin
  insert into tenant_rental_code_counter(tenant_id, current_value)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update
  set current_value = tenant_rental_code_counter.current_value + 1
  returning current_value into next_value;

  return 'CC' || lpad(next_value::text, 4, '0');
end;
$$;

create index if not exists idx_clients_phone on clients(phone);
create index if not exists idx_clients_full_name on clients(full_name);
create index if not exists idx_rental_codes_code on rental_codes(code);
create index if not exists idx_landlords_name on landlords(name);
