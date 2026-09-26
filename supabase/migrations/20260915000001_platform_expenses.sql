-- Harbor Ops' own operating costs.
--
-- The other half of the platform P&L. Revenue is already known — it is
-- `tenant_platform_invoices`, what we bill each agency — but nothing recorded
-- what it costs us to run, so there was no way to see profit.
--
-- NOT `business_overheads`. That table is an AGENCY's own overheads, tenant
-- scoped and readable by that agency, and it feeds their portfolio P&L. This is
-- ours, belongs to no tenant, and no agency may read a row of it. Exactly the
-- same split as `invoices` (agency → its clients) versus
-- `tenant_platform_invoices` (us → the agency).
--
-- The cost model deliberately mirrors `business_overheads` — recurring, one-off,
-- amortised — because the shape is right and it is already understood in this
-- codebase. Two deliberate differences, both documented below: the date fields
-- are simplified, and a recurring cost has a real start.

create table if not exists public.platform_expenses (
  id uuid primary key default gen_random_uuid(),

  -- Kept as text + CHECK rather than a Postgres enum, matching the newer
  -- convention here (tenant_platform_invoice_lines.kind). Labels and grouping
  -- live in src/lib/finance/platformExpenses.ts; adding a category is a deploy,
  -- not a migration, and an enum would need ALTER TYPE either way.
  category text not null check (category in (
    'infrastructure',   -- VPS, Supabase, storage, bandwidth
    'integrations',     -- BoldSign, Resend, deposit schemes, scraper API
    'ai',               -- OpenAI and friends
    'software',         -- GitHub, design tools, the rest of the SaaS stack
    'domains',          -- domains, TLS, DNS
    'payroll',
    'contractors',
    'marketing',
    'professional_fees',-- accountant, legal
    'bank_fees',
    'other'
  )),

  label text not null,
  vendor text,

  -- Integer pence, like every other money column in this schema. For an
  -- amortised cost this is the FULL amount paid, not the monthly slice — the
  -- slice is derived, so changing the term cannot leave the two disagreeing.
  amount_pence integer not null check (amount_pence >= 0),

  cost_mode text not null default 'recurring'
    check (cost_mode in ('recurring', 'one_off', 'amortised')),

  -- WHEN IT STARTS, for every mode. business_overheads carries both
  -- `date_incurred` and `amortise_start_date`; collapsing them removes a field
  -- that could disagree with itself and a whole class of "amortise_start_date is
  -- null so it silently contributes nothing" bugs.
  --
  --   one_off   — the date it was incurred.
  --   recurring — the first month it applies to.
  --   amortised — the first month of the amortisation term.
  starts_on date not null default current_date,

  -- Recurring only: the last month it applies to. Null means ongoing.
  --
  -- business_overheads has no equivalent, and as a result its recurring costs
  -- apply to EVERY month including ones before they existed — adding a
  -- subscription today silently rewrites last year's figures. A dated window is
  -- what stops that here.
  ends_on date,

  -- Amortised only: the term, in months. The monthly charge is
  -- amount_pence / amortise_months, applied from starts_on.
  amortise_months integer check (amortise_months is null or amortise_months > 0),

  -- Soft switch-off, kept from business_overheads: an expense that has stopped
  -- should leave history intact rather than being deleted. Prefer setting
  -- `ends_on` for a recurring cost that ended on a known date — this is for
  -- "ignore this row entirely".
  is_active boolean not null default true,

  notes text,

  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An amortised cost without a term has no monthly slice to compute and would
  -- silently contribute nothing. Refused at the column rather than discovered as
  -- a hole in a profit figure.
  constraint platform_expenses_amortised_needs_term
    check (cost_mode <> 'amortised' or amortise_months is not null),

  -- A window that closes before it opens contributes nothing and is always a
  -- data-entry mistake.
  constraint platform_expenses_window_ordered
    check (ends_on is null or ends_on >= starts_on)
);

create index if not exists idx_platform_expenses_starts
  on public.platform_expenses (starts_on);

create index if not exists idx_platform_expenses_active_mode
  on public.platform_expenses (is_active, cost_mode);

create index if not exists idx_platform_expenses_category
  on public.platform_expenses (category);

create trigger platform_expenses_touch_updated_at
  before update on public.platform_expenses
  for each row execute function public.set_updated_at();

comment on table public.platform_expenses is
  'What it costs to run Harbor Ops. Paired with tenant_platform_invoices to give the platform P&L. Distinct from business_overheads, which is an agency''s own costs.';

comment on column public.platform_expenses.amount_pence is
  'For an amortised cost this is the full amount paid; the monthly slice is derived from amortise_months.';

-- ============================================================
-- Row Level Security
-- ============================================================
-- Enabled with NO policies. Harbor Ops' own cost base is not an agency's
-- business, and there is no tenant to scope it to in the first place. Every read
-- and write goes through the service role behind requireSuperAdmin(), matching
-- platform_audit_log and platform_job_runs.
alter table public.platform_expenses enable row level security;
