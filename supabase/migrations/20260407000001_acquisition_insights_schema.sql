-- Acquisition Insights module: evaluations table schema
-- Phase 6

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'considering'
    check (status in ('considering', 'taken_on', 'passed')),
  linked_property_id uuid references public.properties(id) on delete set null,

  -- Property details
  address text not null,
  postcode text not null,
  detected_area text not null,
  property_type text not null
    check (property_type in ('hmo', 'studio', 'whole_flat')),
  total_rooms integer not null default 1 check (total_rooms >= 1),
  furnished boolean not null default true,

  -- Setup costs (stored in pence)
  furniture_cost integer,
  refurbishment_cost integer,
  upfront_fees integer,
  agency_fees integer,
  other_setup_costs integer,
  other_setup_costs_label text,
  total_setup_cost integer not null default 0,

  -- Monthly costs (pence)
  rent_to_landlord_pcm integer not null default 0,
  bills_pcm integer,
  council_tax_pcm integer,
  cleaning_pcm integer,
  insurance_pcm integer,
  other_costs_pcm integer,
  other_costs_label text,
  total_monthly_costs integer not null default 0,

  -- Revenue assumptions
  expected_occupancy_rate numeric(5,4) not null default 0.8500
    check (expected_occupancy_rate >= 0 and expected_occupancy_rate <= 1),
  rooms jsonb not null default '[]'::jsonb,
  projected_monthly_income integer not null default 0,

  -- AI output (nullable until AI is run)
  ai_recommended_rents jsonb,
  ai_recommended_occupancy numeric(5,4),
  ai_reasoning text,
  ai_comparable_properties jsonb,
  ai_risk_flags jsonb,
  ai_generated_at timestamptz,

  -- Break-even calculations
  monthly_net_profit integer not null default 0,
  break_even_months integer not null default 0,
  break_even_date date,
  annual_roi_percentage numeric(10,4) not null default 0,

  -- Outcome notes (once linked to live property)
  actual_vs_predicted_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evaluations_tenant_id_idx
  on public.evaluations(tenant_id);

create index if not exists evaluations_portfolio_id_idx
  on public.evaluations(portfolio_id);

create index if not exists evaluations_status_idx
  on public.evaluations(status);

create index if not exists evaluations_created_at_idx
  on public.evaluations(created_at desc);

alter table public.evaluations enable row level security;
