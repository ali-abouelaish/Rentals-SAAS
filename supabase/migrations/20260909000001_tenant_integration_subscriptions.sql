-- Self-serve integration subscriptions.
--
-- Until now every feature in `tenant_feature_entitlements` was default-ON: a
-- feature was only unavailable if a row explicitly disabled it, and every
-- entitlement migration granted the key to all tenants. That works for
-- features that ship with the product. It does not work for a PAID integration,
-- where the correct default is "off until the agency asks for it and agrees to
-- be billed".
--
-- This table is the record of that ask. An active row is what grants the
-- feature keys an integration covers (see src/lib/integrations/catalog.ts);
-- src/lib/entitlements/getEntitlements.ts reads it alongside the entitlements
-- table.
--
-- No payment is collected here, by design. Activation records the price agreed
-- and the date it starts; billing happens on the agency's next monthly invoice,
-- raised from the super-admin view. That keeps the activation flow instant —
-- one click, no card — which is the point of self-serve.

create table if not exists public.tenant_integration_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- Matches an `key` in the code-side catalogue. Deliberately not a foreign key
  -- to a catalogue table: the catalogue is code (prices, copy, which feature
  -- keys an integration unlocks), so a DB copy would be a second source of
  -- truth that drifts.
  integration_key text not null,

  -- active         — the agency has it and is billed for it.
  -- pending_setup  — activated, but unusable until credentials or a
  --                  verification step completes. Still grants the feature, so
  --                  the agency can reach the setup screen the feature owns.
  -- cancelled      — access ends on `ends_on`; kept rather than deleted so the
  --                  billing view can still see what ran during the period.
  status text not null default 'active'
    check (status in ('active', 'pending_setup', 'cancelled')),

  -- Price agreed at activation, in pence, so a later price change does not
  -- silently re-price everyone already subscribed. Zero for free integrations
  -- and for grandfathered agencies.
  monthly_price_pence integer not null default 0
    check (monthly_price_pence >= 0),

  -- Agencies that were already using an integration when it became a paid,
  -- opt-in one. They keep access at the price they were paying, which is
  -- nothing. Flagged rather than inferred so the billing view can show who is
  -- on a legacy free ride, and so it is a deliberate decision to start
  -- charging them.
  is_grandfathered boolean not null default false,

  activated_at timestamptz,
  activated_by uuid references public.user_profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.user_profiles(id) on delete set null,

  -- First invoice this should appear on. Set to the first of next month at
  -- activation: the agency gets the rest of the current month free rather than
  -- being part-charged, which avoids proration arithmetic nobody asked for.
  billing_starts_on date,

  -- Cancellation is end-of-period, not immediate — the agency has paid for the
  -- month. Access is granted while this is null or in the future.
  ends_on date,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, integration_key)
);

create index if not exists idx_tenant_integration_subs_tenant
  on public.tenant_integration_subscriptions (tenant_id);

create index if not exists idx_tenant_integration_subs_key
  on public.tenant_integration_subscriptions (integration_key);

create trigger tenant_integration_subscriptions_touch_updated_at
  before update on public.tenant_integration_subscriptions
  for each row execute function public.set_updated_at();

comment on table public.tenant_integration_subscriptions is
  'Per-tenant paid integration subscriptions. An active row grants the feature keys the integration covers. Billed on the next monthly invoice; no payment is taken at activation.';

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.tenant_integration_subscriptions enable row level security;

-- Every member of the agency may see what the agency subscribes to — the
-- Integrations page shows status, and a non-admin hitting a gated feature
-- deserves to be told it is not subscribed rather than that it does not exist.
create policy "tenant_members_select_integration_subscriptions"
  on public.tenant_integration_subscriptions for select
  using (tenant_id = (select current_tenant_id()));

-- Activating an integration commits the agency to a charge, so it is an admin
-- action. Writes also go through server actions that re-check the role; this is
-- the backstop.
create policy "admins_all_integration_subscriptions"
  on public.tenant_integration_subscriptions for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ============================================================
-- Grandfathering
-- ============================================================
-- Paid integrations become default-off the moment the application code that
-- reads this table ships. Any agency already using one would lose it mid-use —
-- for deposit protection, potentially mid-tenancy, on a statutory obligation.
--
-- So: every tenant with evidence of real use gets an active, free row. Evidence
-- is a connection record or a protected deposit, not merely the entitlement
-- being on — the entitlement was on for everyone by default, so it proves
-- nothing about use.
--
-- e_signing is deliberately absent: it is new, no agency is live on it, and
-- there is nothing to preserve.

insert into public.tenant_integration_subscriptions
  (tenant_id, integration_key, status, monthly_price_pence, is_grandfathered,
   activated_at, notes)
select distinct t.id,
       'mydeposits',
       'active',
       0,
       true,
       now(),
       'Grandfathered: in use before integrations became opt-in.'
from public.tenants t
where exists (select 1 from public.mydeposits_connections c where c.tenant_id = t.id)
   or exists (select 1 from public.mydeposits_protections p where p.tenant_id = t.id)
on conflict (tenant_id, integration_key) do nothing;

insert into public.tenant_integration_subscriptions
  (tenant_id, integration_key, status, monthly_price_pence, is_grandfathered,
   activated_at, notes)
select distinct t.id,
       'tds',
       'active',
       0,
       true,
       now(),
       'Grandfathered: in use before integrations became opt-in.'
from public.tenants t
where exists (select 1 from public.tds_connections c where c.tenant_id = t.id)
   or exists (select 1 from public.tds_deposits d where d.tenant_id = t.id)
on conflict (tenant_id, integration_key) do nothing;

insert into public.tenant_integration_subscriptions
  (tenant_id, integration_key, status, monthly_price_pence, is_grandfathered,
   activated_at, notes)
select distinct t.id,
       'dps',
       'active',
       0,
       true,
       now(),
       'Grandfathered: in use before integrations became opt-in.'
from public.tenants t
where exists (select 1 from public.dps_connections c where c.tenant_id = t.id)
   or exists (select 1 from public.dps_deposits d where d.tenant_id = t.id)
on conflict (tenant_id, integration_key) do nothing;

-- ============================================================
-- Clearing the blanket grants
-- ============================================================
-- The deposit-scheme entitlement migrations each granted their key to every
-- tenant on the platform:
--
--   insert into tenant_feature_entitlements (tenant_id, feature_key)
--   select id, 'tds' from tenants;
--
-- Entitlement rows are applied LAST in getEntitlements(), so they override the
-- subscription layer — which is deliberate, it is how a super admin runs a
-- trial or revokes for non-payment. But it means those blanket rows would
-- re-grant every paid integration to everyone and make the whole opt-in model a
-- no-op.
--
-- An `is_enabled = true` row on a paid key carries no information today,
-- precisely because it was inserted for everybody. Deleting it loses nothing:
-- no row means "fall through to the subscription", which is what should have
-- been there all along. Grandfathering is handled above, from evidence of
-- actual use.
--
-- `is_enabled = false` rows are KEPT. Those were somebody deciding a specific
-- tenant should not have a specific feature, and that decision still stands.

delete from public.tenant_feature_entitlements
where feature_key in ('mydeposits', 'tds', 'dps', 'e_signing')
  and is_enabled = true;
