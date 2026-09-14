-- Usage metering.
--
-- What an agency consumes that could be charged for: emails sent, AI assistant
-- messages, deposit registrations. All of it is already recorded — `email_log`,
-- `assistant_messages` and the three deposit tables each carry a tenant_id and
-- a timestamp — and none of it has ever been counted.
--
-- APPROACH: roll up what exists, do not instrument the send sites.
--
-- The alternative — incrementing a counter at every send — means touching
-- roughly twenty call sites, each a chance to miss one or to double-count on a
-- retry. Counting rows that are already being written needs no change to any of
-- them, and reconciles against the source table by construction.
--
-- The counter row is nonetheless the BILLING record, not a cache of the query.
-- Once written it is frozen: deleting an `email_log` row afterwards must not
-- retroactively alter a bill somebody has already been sent.
--
-- E-SIGNING ENVELOPES ARE DELIBERATELY NOT A METER HERE. They are a prepaid
-- credit with a hard stop, metered live by consume_envelope() and billed
-- through tenant_envelope_purchases (20260912000002). Metering them again would
-- bill the same send twice.

create table if not exists public.tenant_usage_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- First day of the month being measured, matching the `billing_period`
  -- convention already used by tenant_envelope_purchases.
  period_start date not null,

  -- Matches a meter in src/lib/billing/meters.ts. Not a foreign key, for the
  -- same reason the integration catalogue and envelope packs are not: rates and
  -- names are code, and a database copy would drift from the logic that uses it.
  meter_key text not null,

  -- What was actually consumed.
  quantity integer not null default 0 check (quantity >= 0),

  -- The allowance at the moment of rollup, frozen onto the row. Raising a
  -- meter's included allowance later must not silently re-price a month that
  -- has already been measured.
  included integer not null default 0 check (included >= 0),

  -- The chargeable overage: max(quantity - included, 0). Stored rather than
  -- derived so the invoice line and the counter can never disagree.
  billable integer not null default 0 check (billable >= 0),

  -- Frozen at rollup, exactly as tenant_integration_subscriptions freezes
  -- monthly_price_pence at activation.
  unit_price_pence integer not null default 0 check (unit_price_pence >= 0),
  amount_pence integer not null default 0 check (amount_pence >= 0),

  rolled_up_at timestamptz not null default now(),

  -- One counter per agency per meter per month. This is what makes the rollup
  -- safely re-runnable: a second pass updates in place rather than doubling.
  unique (tenant_id, period_start, meter_key)
);

create index if not exists idx_usage_counters_period
  on public.tenant_usage_counters (period_start);

create index if not exists idx_usage_counters_tenant_period
  on public.tenant_usage_counters (tenant_id, period_start desc);

comment on table public.tenant_usage_counters is
  'Metered consumption per agency per month, rolled up from the tables that already record each event. The frozen billing record: source rows may later be deleted without altering a bill.';

-- ============================================================
-- Invoice lines: accept usage
-- ============================================================
-- Both constraints were created inline in 20260913000001 and so carry
-- PostgreSQL's default names.
alter table public.tenant_platform_invoice_lines
  drop constraint if exists tenant_platform_invoice_lines_kind_check;

alter table public.tenant_platform_invoice_lines
  add constraint tenant_platform_invoice_lines_kind_check
  check (kind in ('integration', 'envelopes', 'adjustment', 'usage'));

alter table public.tenant_platform_invoice_lines
  drop constraint if exists tenant_platform_invoice_lines_source_kind_check;

alter table public.tenant_platform_invoice_lines
  add constraint tenant_platform_invoice_lines_source_kind_check
  check (source_kind in ('integration_subscription', 'envelope_purchase', 'usage_counter'));

-- An adjustment can be a credit, so a line amount may now be negative. The
-- column never had a non-negative check; the invoice totals do, and they stay
-- that way — a credit may reduce a bill, never take it below zero.

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.tenant_usage_counters enable row level security;

-- An agency may read its own consumption. Unlike a draft invoice, a usage count
-- is not a working figure we might revise — it is a measurement of what they
-- did, and hiding it would make the eventual charge unverifiable.
create policy "tenant_members_select_usage_counters"
  on public.tenant_usage_counters for select
  using (tenant_id = (select current_tenant_id()));

-- No write policy of any kind, not even for admins. These rows are produced by
-- the rollup job through the service role, and an agency admin able to edit its
-- own usage counters could edit its own bill.
