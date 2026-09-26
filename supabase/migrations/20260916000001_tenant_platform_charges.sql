-- What an agency actually pays us, set by a human.
--
-- Until now every charge was derived and nothing could be set. An integration
-- subscription copies its price from the code catalogue at activation
-- (src/lib/integrations/catalog.ts) and freezes it; envelopes are priced by
-- pack; usage is metered. All of that is add-ons. There was no base fee, no
-- negotiated rate, and no screen anywhere for a super admin to say "this agency
-- pays £299 a month" — so the one number a SaaS business is actually built on
-- could not be recorded.
--
-- This table is that number, plus anything else recurring that is agreed rather
-- than derived: a custom line, or an ongoing discount.
--
-- Distinct from tenant_integration_subscriptions, which stays exactly as it is:
-- that table is the catalogue-driven add-ons an agency switched on themselves.
-- This one is what we agreed with them.

create table if not exists public.tenant_platform_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Appears verbatim as the invoice line. "Harbor Ops Professional",
  -- "Onboarding retainer", "Launch discount".
  label text not null,

  -- Integer pence, and NEGATIVE IS ALLOWED — that is what makes a recurring
  -- discount expressible ("-5000" for £50/month off) without a second table and
  -- a second code path. The invoice header keeps its own subtotal >= 0 check, so
  -- a discount can reduce a bill but never take it below zero.
  amount_pence integer not null,

  -- Same window semantics as tenant_integration_subscriptions, deliberately, so
  -- the two behave identically at invoice time and neither needs a special case.
  --
  -- First invoice this appears on. Not nullable: a charge with no start has no
  -- defined first period, and defaulting it silently to "now" is how a fee ends
  -- up on a month nobody agreed to.
  billing_starts_on date not null,

  -- Last month it applies to. Null means ongoing.
  ends_on date,

  notes text,

  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_platform_charges_window_ordered
    check (ends_on is null or ends_on >= billing_starts_on)
);

create index if not exists idx_platform_charges_tenant
  on public.tenant_platform_charges (tenant_id);

-- The generator's lookup: everything still running for a period.
create index if not exists idx_platform_charges_window
  on public.tenant_platform_charges (billing_starts_on, ends_on);

create trigger tenant_platform_charges_touch_updated_at
  before update on public.tenant_platform_charges
  for each row execute function public.set_updated_at();

comment on table public.tenant_platform_charges is
  'Recurring charges a super admin agreed with an agency: base plan fee, custom lines, and ongoing discounts (negative amounts). Distinct from tenant_integration_subscriptions, which is catalogue-priced self-serve add-ons.';

comment on column public.tenant_platform_charges.amount_pence is
  'Integer pence. Negative expresses a recurring discount; the invoice subtotal check still prevents a bill going below zero.';

-- ============================================================
-- Invoice lines: accept a plan charge
-- ============================================================
-- Both constraints were recreated by 20260913000004; recreate them again with
-- the new members rather than assuming their current shape.
alter table public.tenant_platform_invoice_lines
  drop constraint if exists tenant_platform_invoice_lines_kind_check;

alter table public.tenant_platform_invoice_lines
  add constraint tenant_platform_invoice_lines_kind_check
  check (kind in ('integration', 'envelopes', 'adjustment', 'usage', 'plan'));

alter table public.tenant_platform_invoice_lines
  drop constraint if exists tenant_platform_invoice_lines_source_kind_check;

alter table public.tenant_platform_invoice_lines
  add constraint tenant_platform_invoice_lines_source_kind_check
  check (source_kind in (
    'integration_subscription',
    'envelope_purchase',
    'usage_counter',
    'platform_charge'
  ));

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.tenant_platform_charges enable row level security;

-- An agency may read what it has been agreed to pay. It appears on their
-- invoice either way, and a charge they can see explained is one fewer support
-- conversation. Unlike a draft invoice there is nothing provisional here.
create policy "tenant_members_select_platform_charges"
  on public.tenant_platform_charges for select
  using (tenant_id = (select current_tenant_id()));

-- No write policy of any kind, not even for admins: an agency admin able to
-- write here could set their own price to zero. Every write goes through the
-- service role behind requireSuperAdmin().
