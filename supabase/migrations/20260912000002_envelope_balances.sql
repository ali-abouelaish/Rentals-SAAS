-- Envelope credits for e-signing.
--
-- An "envelope" is one document sent for signature, whatever the number of
-- signers on it — the convention BoldSign and DocuSign both use, so it is what
-- agencies already expect to be counted.
--
-- Two pools, and the distinction is the whole design:
--
--   ALLOWANCE — included with the e-signing subscription, resets on the 1st,
--               does NOT roll over. This is what makes the monthly fee feel
--               like value rather than a gate.
--   TOP-UP    — bought in packs, never expires. Billed on the next invoice,
--               exactly like an integration subscription; no card, no payment
--               taken at the point of purchase.
--
-- Spending takes from the ALLOWANCE first. It is the perishable pool: burning
-- purchased envelopes while free ones expire at month end would quietly cost
-- the agency money, and they would be right to be annoyed about it.
--
-- The allowance resets lazily, inside `consume_envelope`, rather than from a
-- scheduled job. A cron that fails leaves every agency unable to send; a lazy
-- reset cannot drift, because the period is derived from the clock at the
-- moment it is needed.

-- ============================================================
-- 1. Balances — one row per tenant
-- ============================================================
create table if not exists public.tenant_envelope_balances (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,

  -- First day of the month this allowance belongs to. When it falls behind the
  -- current month, the allowance is stale and gets reset on next use.
  allowance_period date not null,

  -- What the plan granted for `allowance_period`. Stored rather than read from
  -- code at spend time so that changing the plan's allowance doesn't
  -- retroactively alter a month already part-spent.
  allowance_total integer not null default 0 check (allowance_total >= 0),
  allowance_used integer not null default 0 check (allowance_used >= 0),

  -- Purchased envelopes. No expiry.
  topup_balance integer not null default 0 check (topup_balance >= 0),

  -- Lifetime counter, for the settings page. Cheaper than counting documents
  -- and unaffected by a document row later being deleted.
  lifetime_sent integer not null default 0 check (lifetime_sent >= 0),

  updated_at timestamptz not null default now()
);

create trigger tenant_envelope_balances_touch_updated_at
  before update on public.tenant_envelope_balances
  for each row execute function public.set_updated_at();

comment on table public.tenant_envelope_balances is
  'E-signing envelope credits per tenant: a monthly subscription allowance that resets, plus purchased top-ups that do not.';

-- ============================================================
-- 2. Purchases — what to put on the next invoice
-- ============================================================
create table if not exists public.tenant_envelope_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Matches a pack in src/lib/envelopes/packs.ts. Not a foreign key for the
  -- same reason the integration catalogue isn't one: the packs are code.
  pack_key text not null,
  envelopes integer not null check (envelopes > 0),

  -- Price agreed at purchase, frozen onto the row. A later price change must
  -- not rewrite what somebody already bought.
  price_pence integer not null check (price_pence >= 0),

  -- The invoice this lands on: the 1st of the month after purchase, matching
  -- how integration subscriptions bill.
  billing_period date not null,

  purchased_at timestamptz not null default now(),
  purchased_by uuid references public.user_profiles(id) on delete set null,

  -- Set once it has actually been invoiced, so the super-admin view can show
  -- "to bill" separately from "already billed".
  invoiced_at timestamptz
);

create index if not exists idx_envelope_purchases_tenant
  on public.tenant_envelope_purchases (tenant_id);

create index if not exists idx_envelope_purchases_billing
  on public.tenant_envelope_purchases (billing_period)
  where invoiced_at is null;

comment on table public.tenant_envelope_purchases is
  'Envelope top-up purchases. No payment is taken; each row is a line to add to the tenant''s next monthly invoice.';

-- ============================================================
-- 3. Row Level Security
-- ============================================================
alter table public.tenant_envelope_balances enable row level security;
alter table public.tenant_envelope_purchases enable row level security;

-- Anyone in the agency may see the balance — a negotiator about to send a
-- contract needs to know there are two left, not discover it on the click.
create policy "tenant_members_select_envelope_balances"
  on public.tenant_envelope_balances for select
  using (tenant_id = (select current_tenant_id()));

create policy "tenant_members_select_envelope_purchases"
  on public.tenant_envelope_purchases for select
  using (tenant_id = (select current_tenant_id()));

-- Writes go through the service role (the send path and the purchase action),
-- never from the browser. Admins get a policy anyway as the backstop, matching
-- how the other billing-adjacent tables are set up.
create policy "admins_all_envelope_balances"
  on public.tenant_envelope_balances for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

create policy "admins_all_envelope_purchases"
  on public.tenant_envelope_purchases for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ============================================================
-- 4. Atomic consumption
-- ============================================================
-- This has to be a function, not a read-then-write in application code. Two
-- "Send for signature" clicks landing together would both read a balance of 1
-- and both decide they could spend it, and the agency would have sent two
-- documents having paid for one. A single statement under the row lock cannot
-- interleave.
--
-- p_allowance is passed in rather than read from a table because the plan's
-- monthly allowance lives in code alongside the price. It is applied only when
-- the period rolls over, so mid-month it can change without disturbing an
-- allowance already being spent.
create or replace function public.consume_envelope(
  p_tenant_id uuid,
  p_allowance integer
)
returns jsonb
language plpgsql
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_row public.tenant_envelope_balances%rowtype;
  v_source text;
begin
  -- Create on first use, already stamped with the current period so the branch
  -- below sees it as fresh.
  insert into public.tenant_envelope_balances
    (tenant_id, allowance_period, allowance_total, allowance_used, topup_balance)
  values (p_tenant_id, v_period, greatest(p_allowance, 0), 0, 0)
  on conflict (tenant_id) do nothing;

  -- FOR UPDATE is what serialises concurrent sends: the second caller waits
  -- here until the first has committed its decrement.
  select * into v_row
  from public.tenant_envelope_balances
  where tenant_id = p_tenant_id
  for update;

  -- Lazy monthly reset. Unused allowance is discarded rather than carried —
  -- that is the deal, and rolling it over silently would make the balance
  -- grow without bound for light users.
  if v_row.allowance_period < v_period then
    v_row.allowance_period := v_period;
    v_row.allowance_total  := greatest(p_allowance, 0);
    v_row.allowance_used   := 0;
  end if;

  -- Allowance first: it expires, the top-ups do not.
  if v_row.allowance_used < v_row.allowance_total then
    v_row.allowance_used := v_row.allowance_used + 1;
    v_source := 'allowance';
  elsif v_row.topup_balance > 0 then
    v_row.topup_balance := v_row.topup_balance - 1;
    v_source := 'topup';
  else
    -- Persist any period reset even on refusal, so the caller's reported
    -- balance reflects the new month rather than last month's exhausted one.
    update public.tenant_envelope_balances
    set allowance_period = v_row.allowance_period,
        allowance_total  = v_row.allowance_total,
        allowance_used   = v_row.allowance_used
    where tenant_id = p_tenant_id;

    return jsonb_build_object(
      'ok', false,
      'reason', 'out_of_envelopes',
      'allowance_remaining', 0,
      'topup_remaining', 0,
      'remaining', 0
    );
  end if;

  update public.tenant_envelope_balances
  set allowance_period = v_row.allowance_period,
      allowance_total  = v_row.allowance_total,
      allowance_used   = v_row.allowance_used,
      topup_balance    = v_row.topup_balance,
      lifetime_sent    = v_row.lifetime_sent + 1
  where tenant_id = p_tenant_id;

  return jsonb_build_object(
    'ok', true,
    'source', v_source,
    'allowance_remaining', v_row.allowance_total - v_row.allowance_used,
    'topup_remaining', v_row.topup_balance,
    'remaining', (v_row.allowance_total - v_row.allowance_used) + v_row.topup_balance
  );
end;
$$;

comment on function public.consume_envelope(uuid, integer) is
  'Atomically spend one envelope, allowance before top-ups, resetting a stale monthly allowance first. Returns {ok, source, remaining, ...}.';

-- ============================================================
-- 5. Refund
-- ============================================================
-- A send that fails after the envelope was taken must give it back. Without
-- this an agency is charged for a document that was never delivered — the
-- kind of error that costs far more in trust than the envelope is worth.
--
-- Refunds to the pool it came from, so a refunded allowance envelope is usable
-- again this month and a refunded top-up stays permanent.
create or replace function public.refund_envelope(
  p_tenant_id uuid,
  p_source text
)
returns void
language plpgsql
as $$
begin
  if p_source = 'allowance' then
    update public.tenant_envelope_balances
    set allowance_used = greatest(allowance_used - 1, 0),
        lifetime_sent  = greatest(lifetime_sent - 1, 0)
    where tenant_id = p_tenant_id;
  elsif p_source = 'topup' then
    update public.tenant_envelope_balances
    set topup_balance = topup_balance + 1,
        lifetime_sent = greatest(lifetime_sent - 1, 0)
    where tenant_id = p_tenant_id;
  end if;
  -- Any other source is a no-op rather than an error: a refund for something
  -- that was never charged should not fail the caller's error path, which is
  -- already handling a failed send.
end;
$$;

comment on function public.refund_envelope(uuid, text) is
  'Return one envelope to the pool it was taken from, after a send that failed downstream.';

-- ============================================================
-- 6. Credit a purchase
-- ============================================================
create or replace function public.credit_envelopes(
  p_tenant_id uuid,
  p_envelopes integer,
  p_allowance integer
)
returns integer
language plpgsql
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_total integer;
begin
  if p_envelopes <= 0 then
    raise exception 'credit_envelopes requires a positive quantity';
  end if;

  insert into public.tenant_envelope_balances
    (tenant_id, allowance_period, allowance_total, allowance_used, topup_balance)
  values (p_tenant_id, v_period, greatest(p_allowance, 0), 0, p_envelopes)
  on conflict (tenant_id) do update
    set topup_balance = public.tenant_envelope_balances.topup_balance + p_envelopes;

  select (allowance_total - allowance_used) + topup_balance
  into v_total
  from public.tenant_envelope_balances
  where tenant_id = p_tenant_id;

  return v_total;
end;
$$;

comment on function public.credit_envelopes(uuid, integer, integer) is
  'Add purchased envelopes to the tenant''s non-expiring top-up balance. Returns the new total available.';
