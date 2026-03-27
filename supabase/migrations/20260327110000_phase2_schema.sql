-- Phase 2: Bookings, PM Tenants, Contracts & Booking Forms
-- Creates pm_tenants, guarantors, property_contracts, booking_forms,
-- form_questions, bookings, form_responses.
-- Also alters units to add pm_tenant_id and drop deprecated contract columns.

-- ============================================================
-- pm_tenants (property management tenants)
-- Named pm_tenants to avoid collision with SaaS multi-tenant 'tenants' table
-- ============================================================
create table if not exists public.pm_tenants (
  id                              uuid primary key default gen_random_uuid(),
  tenant_id                       uuid not null references public.tenants(id) on delete cascade,
  full_name                       text not null,
  email                           text not null,
  phone                           text not null,
  whatsapp_number                 text,
  date_of_birth                   date,
  nationality                     text,
  current_address                 text,
  employment_status               text check (employment_status in ('professional','student','self_employed','unemployed','other')),
  employer_name                   text,
  employer_address                text,
  job_title                       text,
  current_landlord_name           text,
  current_landlord_contact        text,
  right_to_rent_type              text check (right_to_rent_type in ('british_passport','share_code','eu_settled','visa','other')),
  right_to_rent_code              text,
  right_to_rent_expiry            date,
  right_to_rent_verified          boolean not null default false,
  emergency_contact_name          text,
  emergency_contact_phone         text,
  emergency_contact_relationship  text,
  notes                           text,
  passport_photo_url              text,
  passport_scan_url               text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

-- ============================================================
-- guarantors
-- ============================================================
create table if not exists public.guarantors (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  pm_tenant_id    uuid not null references public.pm_tenants(id) on delete cascade,
  full_name       text not null,
  phone           text not null,
  email           text not null,
  relationship    text,
  passport_url    text,
  payslips_url    text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- property_contracts (periodic/rolling — no fixed end date)
-- ============================================================
create table if not exists public.property_contracts (
  id                           uuid primary key default gen_random_uuid(),
  tenant_id                    uuid not null references public.tenants(id) on delete cascade,
  unit_id                      uuid not null references public.units(id) on delete cascade,
  pm_tenant_id                 uuid not null references public.pm_tenants(id) on delete restrict,
  start_date                   date not null,
  rent_pcm                     integer not null,
  deposit                      integer not null,
  collection_date              integer check (collection_date between 1 and 31),
  deposit_scheme               text not null default 'none' check (deposit_scheme in ('dps','mydeposits','tds','none')),
  deposit_scheme_ref           text,
  deposit_protected_date       date,
  deposit_protection_deadline  date,
  deposit_protection_alert     boolean not null default true,
  signing_method               text check (signing_method in ('email','whatsapp','adobe_sign','docusign','paper','other')),
  status                       text not null default 'draft' check (status in ('draft','sent','signed','active','notice_given','terminated')),
  notice_given_by              text check (notice_given_by in ('tenant','landlord')),
  notice_given_date            date,
  vacate_date                  date,
  document_url                 text,
  notes                        text,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

-- ============================================================
-- booking_forms (dynamic form templates)
-- ============================================================
create table if not exists public.booking_forms (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  portfolio_id    uuid references public.portfolios(id) on delete set null,
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  public_slug     text not null unique,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- form_questions
-- ============================================================
create table if not exists public.form_questions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  form_id         uuid not null references public.booking_forms(id) on delete cascade,
  question_text   text not null,
  question_type   text not null check (question_type in ('text','textarea','email','phone','date','select','checkbox','file_upload','number')),
  options         jsonb,
  is_required     boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- bookings (applications from prospective tenants)
-- ============================================================
create table if not exists public.bookings (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  unit_id                 uuid references public.units(id) on delete set null,
  property_id             uuid references public.properties(id) on delete set null,
  portfolio_id            uuid references public.portfolios(id) on delete set null,
  form_id                 uuid references public.booking_forms(id) on delete set null,
  status                  text not null default 'pending' check (status in ('pending','under_review','approved','rejected')),
  applicant_name          text not null,
  applicant_email         text not null,
  applicant_phone         text not null,
  submitted_at            timestamptz not null default now(),
  reviewed_at             timestamptz,
  reviewed_by             uuid references public.user_profiles(id) on delete set null,
  rejection_reason        text,
  converted_pm_tenant_id  uuid references public.pm_tenants(id) on delete set null,
  notes                   text,
  created_at              timestamptz not null default now()
);

-- ============================================================
-- form_responses
-- ============================================================
create table if not exists public.form_responses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  question_id     uuid not null references public.form_questions(id) on delete cascade,
  answer_text     text,
  answer_file_url text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- ALTER units — add pm_tenant_id, drop deprecated contract columns
-- ============================================================
alter table public.units
  add column if not exists pm_tenant_id uuid references public.pm_tenants(id) on delete set null;

alter table public.units
  drop column if exists contract_start_date,
  drop column if exists contract_end_date,
  drop column if exists collection_date;

-- ============================================================
-- Indexes for common queries
-- ============================================================
create index if not exists idx_pm_tenants_tenant_id on public.pm_tenants(tenant_id);
create index if not exists idx_guarantors_pm_tenant_id on public.guarantors(pm_tenant_id);
create index if not exists idx_property_contracts_unit_id on public.property_contracts(unit_id);
create index if not exists idx_property_contracts_pm_tenant_id on public.property_contracts(pm_tenant_id);
create index if not exists idx_property_contracts_status on public.property_contracts(status);
create index if not exists idx_bookings_tenant_id on public.bookings(tenant_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_unit_id on public.bookings(unit_id);
create index if not exists idx_form_questions_form_id on public.form_questions(form_id);
create index if not exists idx_form_responses_booking_id on public.form_responses(booking_id);
create index if not exists idx_units_pm_tenant_id on public.units(pm_tenant_id);
