-- BoldSign e-signing, phase 5: per-agency sending identity.
--
-- Documents must reach tenants and landlords looking like they came from their
-- letting agent, not from Harbor Ops. BoldSign models this as a "brand": a
-- logo, colours, an email display name and a legal disclaimer, referenced by
-- brandId on each send.
--
-- Two mechanisms exist, and which one is usable depends on the BoldSign plan:
--
--   - A BRAND covers everything the agency's recipients see (logo, colours, the
--     name on the email, the disclaimer) and applies immediately with no
--     verification step. Measured against the sandbox account on 2026-08-27:
--     brand creation is REJECTED with "Your account has reached the limit for
--     the number of brands that can be created" — the plan allows exactly one.
--     Per-agency brands therefore need a plan that includes enough of them.
--   - A SENDER IDENTITY changes the actual From address. Verified as creatable
--     on the same account, so it is the mechanism that works today, but each
--     agency must confirm its mailbox with BoldSign before anything can be sent
--     under it — real onboarding friction, and a verification email that must
--     not be triggered without the agency's knowledge.
--
-- This table supports both, so the choice stays a configuration decision rather
-- than a schema change. brand_id is nullable for agencies on the sender-identity
-- path; sender_identity_email is nullable for agencies on the brand path.
--
-- The brand content itself is not stored here — it is derived from the agency's
-- existing Harbor Ops branding (tenant_branding_settings, falling back to
-- tenants.branding) via src/lib/branding/agency-brand.ts. This table records
-- only the mapping and enough of a snapshot to detect drift.

create table if not exists public.boldsign_agency_brands (
  tenant_id             uuid primary key references public.tenants(id) on delete cascade,

  -- BoldSign's brand id, passed as brandId at send time. Null for an agency on
  -- the sender-identity path, or one not provisioned yet (which still sends,
  -- under the account default).
  brand_id              text unique,

  -- Snapshot of what was last pushed to BoldSign. Compared against the agency's
  -- current branding to decide whether the brand needs re-syncing; without it
  -- there is no way to tell a stale brand from an up-to-date one.
  brand_name            text,
  email_display_name    text,
  logo_source_url       text,
  primary_color         text,

  -- The send-on-behalf path. Set once the agency has verified this mailbox with
  -- BoldSign; passed as onBehalfOf at send time.
  sender_identity_email text,
  sender_identity_id    text,
  sender_identity_verified_at timestamptz,

  -- Consent to send under the agency's identity. Recorded even though brands
  -- (unlike sender identities) don't change the From address, because the
  -- agency's name and logo still appear on a legally binding document.
  consent_given_at      timestamptz,
  consent_given_by      uuid references public.user_profiles(id) on delete set null,
  consent_note          text,

  last_synced_at        timestamptz,
  last_error            text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- A row exists to name an identity; one without either mechanism would
  -- silently behave exactly like having no row at all.
  constraint boldsign_agency_brands_has_identity
    check (brand_id is not null or sender_identity_email is not null)
);

create trigger boldsign_agency_brands_touch_updated_at
  before update on public.boldsign_agency_brands
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.boldsign_agency_brands enable row level security;

-- Agency staff may see which identity their documents send under.
create policy "tenant_members_select_boldsign_agency_brands"
  on public.boldsign_agency_brands for select
  using (tenant_id = (select current_tenant_id()));

-- Provisioning is a server-side action; admins may also correct rows.
create policy "admins_all_boldsign_agency_brands"
  on public.boldsign_agency_brands for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());
