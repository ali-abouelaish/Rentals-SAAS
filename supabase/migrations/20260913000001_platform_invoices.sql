-- Platform billing: what Harbor Ops charges each agency.
--
-- Not to be confused with `invoices`, which is an AGENCY billing ITS OWN
-- clients. This is the other direction — the bill we raise against a tenant for
-- their paid integrations and envelope top-ups.
--
-- Everything up to now recorded a charge and stopped: an integration
-- subscription knows its price and its billing start, an envelope purchase
-- knows what it cost and which invoice it belongs on, and nothing ever gathered
-- them. `tenant_envelope_purchases.invoiced_at` had no writer, so purchases
-- would have shown as outstanding forever.
--
-- Shape follows `owner_statements`: one document per (tenant, period), with
-- lines, moving draft → issued → paid, and generated into DRAFT by a monthly
-- job so a human decides when anything becomes real.
--
-- Money is INTEGER PENCE throughout, matching every other money column in the
-- schema. No floats anywhere near a total.

-- ============================================================
-- 1. Invoices
-- ============================================================
create table if not exists public.tenant_platform_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  period_year  int  not null,
  period_month int  not null check (period_month between 1 and 12),
  period_start date not null,
  period_end   date not null,

  subtotal_pence integer not null default 0 check (subtotal_pence >= 0),

  -- VAT in basis points (2000 = 20%), stored per invoice rather than read from
  -- config at display time so a rate change never rewrites history. Currently
  -- zero; see VAT_RATE_BPS in src/lib/billing/rates.ts.
  vat_rate_bps integer not null default 0 check (vat_rate_bps >= 0),
  vat_pence    integer not null default 0 check (vat_pence >= 0),
  total_pence  integer not null default 0 check (total_pence >= 0),

  -- draft  — generated, changeable, safe to regenerate.
  -- issued — sent to the agency. Frozen: regeneration must never touch it.
  -- paid   — settled.
  -- void   — cancelled; excluded from every total.
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'paid', 'void')),

  issued_at timestamptz,
  paid_at   timestamptz,
  void_at   timestamptz,
  notes text,

  generated_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One LIVE invoice per agency per month — void ones are excluded.
--
-- A plain unique constraint would make voiding a dead end: the period could
-- never be regenerated, and any envelope purchases released by the void would
-- have nowhere to go, since a purchase is matched on the billing period
-- stamped at the point of sale and that never changes. Voiding a wrong invoice
-- and raising a corrected one is the normal way to fix a billing mistake, so
-- the index has to permit it.
create unique index if not exists tenant_platform_invoices_one_live_per_period
  on public.tenant_platform_invoices (tenant_id, period_year, period_month)
  where status <> 'void';

create index if not exists idx_platform_invoices_period
  on public.tenant_platform_invoices (period_year, period_month);

create index if not exists idx_platform_invoices_status
  on public.tenant_platform_invoices (status);

create trigger tenant_platform_invoices_touch_updated_at
  before update on public.tenant_platform_invoices
  for each row execute function public.set_updated_at();

comment on table public.tenant_platform_invoices is
  'What Harbor Ops bills an agency for a month: paid integrations plus envelope top-ups. Distinct from public.invoices, which is an agency billing its own clients.';

-- ============================================================
-- 2. Lines
-- ============================================================
create table if not exists public.tenant_platform_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null
    references public.tenant_platform_invoices(id) on delete cascade,

  -- integration — a recurring monthly subscription.
  -- envelopes   — a one-off top-up purchase.
  -- adjustment  — a manual credit or charge added by a super admin.
  kind text not null check (kind in ('integration', 'envelopes', 'adjustment')),

  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_pence integer not null,
  amount_pence integer not null,

  -- What this line came from: an integration key, or a
  -- tenant_envelope_purchases id. Kept so a regenerated draft can be rebuilt
  -- from the same sources, and so a query can answer "was this purchase
  -- billed, and on which invoice?" without guessing from amounts.
  source_kind text check (source_kind in ('integration_subscription', 'envelope_purchase')),
  source_ref  text,

  created_at timestamptz not null default now()
);

create index if not exists idx_platform_invoice_lines_invoice
  on public.tenant_platform_invoice_lines (invoice_id);

create index if not exists idx_platform_invoice_lines_source
  on public.tenant_platform_invoice_lines (source_kind, source_ref);

comment on table public.tenant_platform_invoice_lines is
  'Line items on a platform invoice. source_kind/source_ref trace each line back to the subscription or purchase that produced it.';

-- ============================================================
-- 3. Link a purchase to the invoice that billed it
-- ============================================================
-- `invoiced_at` said THAT a purchase had been billed but not WHERE. When an
-- agency queries a charge, "it's on your October invoice" needs the id.
alter table public.tenant_envelope_purchases
  add column if not exists invoice_id uuid
    references public.tenant_platform_invoices(id) on delete set null;

comment on column public.tenant_envelope_purchases.invoice_id is
  'The platform invoice this purchase was billed on. Null until invoiced; cleared if that invoice is voided, which returns the purchase to the pool for the next run.';

-- ============================================================
-- 4. Row Level Security
-- ============================================================
alter table public.tenant_platform_invoices enable row level security;
alter table public.tenant_platform_invoice_lines enable row level security;

-- An agency may read its own bills — they are about to be asked to pay them,
-- and a charge nobody can see is a support ticket waiting to happen. Draft
-- invoices are excluded: a draft is our working copy and may still change.
create policy "tenant_members_select_platform_invoices"
  on public.tenant_platform_invoices for select
  using (tenant_id = (select current_tenant_id()) and status <> 'draft');

create policy "tenant_members_select_platform_invoice_lines"
  on public.tenant_platform_invoice_lines for select
  using (
    exists (
      select 1
      from public.tenant_platform_invoices i
      where i.id = invoice_id
        and i.tenant_id = (select current_tenant_id())
        and i.status <> 'draft'
    )
  );

-- No agency-side write policy at all. These are raised by the platform, and an
-- agency admin must not be able to edit, void or mark its own bill paid. Every
-- write goes through the service role behind requireSuperAdmin().
