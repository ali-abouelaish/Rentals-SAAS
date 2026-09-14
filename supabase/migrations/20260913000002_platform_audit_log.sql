-- Platform audit log: what Harbor Ops staff and the platform itself did.
--
-- Deliberately NOT `activity_log`, and the reason is a live bug rather than a
-- preference.
--
-- `activity_log` is a TENANT log: every agency can read its own rows, which is
-- the whole point of the activity feed. Recording platform operations there has
-- three consequences, and all three are live today:
--
--   1. Internal operations leak into the customer's feed. Suspending an agency,
--      toggling its entitlements, reassigning its access profiles — all of it
--      currently lands in that agency's own activity list, metadata included.
--      Those are our operational records, not theirs.
--   2. Super-admin invites are attributed to the wrong agency. That call has no
--      subject tenant to pass, so it stamps the ACTOR's tenant_id
--      (src/features/admin/actions/admin.ts) — meaning whichever agency the
--      acting super admin happens to sit in can read that a new super admin was
--      created, and for whom.
--   3. A platform event with no agency at all (a cron run, a failed mailbox
--      health check) cannot be recorded, because `tenant_id` is NOT NULL.
--
-- This table fixes all three: `tenant_id` is nullable and means the SUBJECT,
-- and no agency can read any of it. `activity_log` keeps its present meaning —
-- tenant business events, readable by that tenant — and is left untouched.

create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),

  -- Null actor means the platform itself: a cron job, a webhook, a sweep.
  -- Those are real audit events and must not be forced to borrow a human.
  actor_user_id uuid references public.user_profiles(id) on delete set null,

  -- Denormalised so the trail survives the profile being deleted. An audit row
  -- that reads "someone (deleted) suspended this agency" has lost the fact it
  -- existed to preserve.
  actor_email text,

  category text not null check (category in (
    'tenant',      -- created, suspended, branding, module config
    'billing',     -- invoices issued/paid/voided, adjustments, subscriptions
    'access',      -- roles, invites, access profiles, user activation
    'integration', -- deposit scheme credentials, e-signing identities, mailboxes
    'system',      -- cron runs, migrations, maintenance
    'security'     -- super admin invites, permission escalation
  )),

  -- Dotted verb-last form: 'tenant.suspended', 'invoice.issued'. Sorts into
  -- sensible groups and reads without a lookup table.
  action text not null,

  -- The agency this was done TO. Null for genuinely platform-wide events.
  -- ON DELETE SET NULL, not CASCADE: deleting an agency must not erase the
  -- record of what was done to it.
  tenant_id uuid references public.tenants(id) on delete set null,

  entity_type text,
  -- Text rather than uuid: not every subject has one. A feature entitlement is
  -- keyed by 'e_signing', an integration subscription by its catalogue key.
  entity_id text,

  -- One human-readable line, written at the call site and rendered directly.
  -- Composing this in the UI from action + metadata means every new action
  -- needs a UI change to be legible; writing it here means the log is readable
  -- the moment something new starts logging.
  summary text not null,

  -- The values either side of a change. "features changed" is useless;
  -- "e_signing: false -> true" is an audit trail. Null for events that are not
  -- changes (an invite sent, a job run).
  "before" jsonb,
  "after" jsonb,

  metadata jsonb,

  severity text not null default 'info'
    check (severity in ('info', 'warning', 'error')),

  created_at timestamptz not null default now()
);

-- The default view is "everything, newest first".
create index if not exists idx_platform_audit_created
  on public.platform_audit_log (created_at desc);

create index if not exists idx_platform_audit_category_created
  on public.platform_audit_log (category, created_at desc);

-- "What has been done to this agency" — the subject filter.
create index if not exists idx_platform_audit_tenant_created
  on public.platform_audit_log (tenant_id, created_at desc);

-- "What has this admin done" — the accountability filter.
create index if not exists idx_platform_audit_actor_created
  on public.platform_audit_log (actor_user_id, created_at desc);

create index if not exists idx_platform_audit_action_created
  on public.platform_audit_log (action, created_at desc);

comment on table public.platform_audit_log is
  'Audit trail for platform operations: what Harbor Ops staff did to which agency, and what the platform did on its own. Distinct from activity_log, which is per-tenant business activity readable by that tenant.';

comment on column public.platform_audit_log.tenant_id is
  'The agency acted UPON, not the actor''s own agency. Null for platform-wide events.';

-- ============================================================
-- Row Level Security
-- ============================================================
-- Enabled with NO policies at all. Every read and write goes through the
-- service-role client behind requireSuperAdmin().
--
-- This is the established pattern for super-admin-only tables here — see
-- tenant_feature_entitlements in 20260705000001_rls_close_unprotected_tables.sql
-- and tenant_platform_invoices in 20260913000001_platform_invoices.sql. RLS
-- cannot express "super admin" anyway: is_admin() is true for a plain agency
-- admin too, so a policy written in terms of it would hand every agency admin
-- the cross-tenant log.
--
-- No policy is stronger than a restrictive one: with RLS on and nothing
-- granted, PostgREST returns zero rows to every agency user regardless of role.
alter table public.platform_audit_log enable row level security;
