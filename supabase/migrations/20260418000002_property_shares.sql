-- Property Shares v1
-- Token-gated public share links for external partners. No auth, no accounts;
-- the URL token is the only access control. Shares are scoped to the creator's
-- tenant — the public /s/[token] endpoint only ever exposes units from that tenant.
--
-- Design notes:
--   - No new columns on units. availability_statuses[] subsets the existing
--     units.status enum: 'available','occupied','move_out','booked','on_hold','renewal','replacement'.
--   - commission_override_pct is NOT NULL in v1 (no default commission field exists
--     on properties/units to fall back to).
--   - share_views is inserted via the admin client from the public tracking route,
--     so RLS for INSERT is intentionally restrictive (admins only through DB; the
--     public path uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS).

-- ============================================================
-- 1. property_shares
-- ============================================================
create table if not exists public.property_shares (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  token                    text not null,
  name                     text not null,
  description              text,
  availability_statuses    text[] not null,
  commission_override_pct  numeric(5,2) not null,
  expires_at               timestamptz,
  revoked_at               timestamptz,
  created_by               uuid not null references public.user_profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint property_shares_token_unique unique (token),
  constraint property_shares_availability_statuses_valid
    check (availability_statuses <@ array[
      'available','occupied','move_out','booked','on_hold','renewal','replacement'
    ]::text[]),
  constraint property_shares_availability_statuses_nonempty
    check (array_length(availability_statuses, 1) >= 1),
  constraint property_shares_commission_override_pct_range
    check (commission_override_pct >= 0 and commission_override_pct <= 100)
);

create index if not exists property_shares_tenant_id_idx
  on public.property_shares (tenant_id);

create index if not exists property_shares_availability_statuses_gin_idx
  on public.property_shares using gin (availability_statuses);

-- ============================================================
-- 2. share_views (analytics)
-- ============================================================
create table if not exists public.share_views (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null references public.property_shares(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  ip_hash     text,
  user_agent  text
);

create index if not exists share_views_share_id_idx    on public.share_views (share_id);
create index if not exists share_views_viewed_at_idx   on public.share_views (viewed_at);

-- ============================================================
-- 3. Row Level Security
-- Public /s/[token] and /api/shares/[token]/* use the admin client (bypasses RLS)
-- and scope by token/tenant_id manually. These policies govern admin-side access.
-- ============================================================
alter table public.property_shares enable row level security;
alter table public.share_views     enable row level security;

-- property_shares: tenant members can read, admins can write
drop policy if exists "property_shares select" on public.property_shares;
create policy "property_shares select" on public.property_shares
  for select using (tenant_id = (select current_tenant_id()));

drop policy if exists "property_shares insert" on public.property_shares;
create policy "property_shares insert" on public.property_shares
  for insert with check (tenant_id = (select current_tenant_id()) and is_admin());

drop policy if exists "property_shares update" on public.property_shares;
create policy "property_shares update" on public.property_shares
  for update using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

drop policy if exists "property_shares delete" on public.property_shares;
create policy "property_shares delete" on public.property_shares
  for delete using (tenant_id = (select current_tenant_id()) and is_admin());

-- share_views: readable by tenant members (for analytics on /admin/shares/[id]),
-- writable only by admins (public tracking path uses admin client, bypassing RLS).
drop policy if exists "share_views select" on public.share_views;
create policy "share_views select" on public.share_views
  for select using (
    exists (
      select 1 from public.property_shares s
      where s.id = share_views.share_id
        and s.tenant_id = (select current_tenant_id())
    )
  );

drop policy if exists "share_views insert" on public.share_views;
create policy "share_views insert" on public.share_views
  for insert with check (
    is_admin() and exists (
      select 1 from public.property_shares s
      where s.id = share_views.share_id
        and s.tenant_id = (select current_tenant_id())
    )
  );

-- ============================================================
-- 4. Feature entitlement
-- Seeds the 'property_shares' feature entitlement for all existing tenants.
-- ============================================================
insert into public.tenant_feature_entitlements (tenant_id, feature_key, is_enabled)
select id, 'property_shares', true
from public.tenants
on conflict (tenant_id, feature_key) do nothing;
