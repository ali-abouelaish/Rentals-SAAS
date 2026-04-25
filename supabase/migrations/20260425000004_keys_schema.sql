-- ============================================================
-- Keys tracking — schema, indexes, RLS, search vector
-- ============================================================
-- Models physical key handover for letting agents.
--
-- Spec name mapping (external spec → Harbor Ops):
--   workspaces  → tenants
--   users       → user_profiles
--   tenants     → pm_tenants is unrelated; the "tenancy" purpose
--                 references property_contracts indirectly via
--                 application code (not a hard FK).
--
-- One row per individual physical key. "Sets" are just a `set_name`
-- text grouping, not a separate table.
-- ============================================================

-- ─── keys ──────────────────────────────────────────────────
create table if not exists public.keys (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete cascade,
  unit_id      uuid references public.units(id) on delete cascade,
  set_name     text not null,
  copy_label   text not null,
  status       text not null default 'in_office'
                 check (status in ('in_office','loaned','with_tenant','lost','destroyed')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- at least one of property_id / unit_id must be set
  check (property_id is not null or unit_id is not null),
  -- copy_label is unique within a (property|unit, set_name) grouping
  unique (property_id, unit_id, set_name, copy_label)
);

create index if not exists keys_tenant_idx     on public.keys(tenant_id);
create index if not exists keys_property_idx   on public.keys(property_id);
create index if not exists keys_unit_idx       on public.keys(unit_id);
create index if not exists keys_status_idx     on public.keys(tenant_id, status);

-- Search vector — feeds the global Cmd+K search via the union in
-- the global_search RPC (see migration 20260425000003).
alter table public.keys
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(set_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(copy_label, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) stored;

create index if not exists keys_search_vector_idx
  on public.keys using gin (search_vector);

-- ─── key_assignments ───────────────────────────────────────
create table if not exists public.key_assignments (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  key_id                uuid not null references public.keys(id) on delete cascade,

  -- who has it: either an internal user, or a free-text contact
  held_by_user_id       uuid references public.user_profiles(id) on delete set null,
  held_by_contact_name  text,
  held_by_contact_phone text,

  -- why
  purpose               text not null
                          check (purpose in ('viewing','tenancy','maintenance','inspection','other')),
  viewing_id            uuid,                    -- nullable; viewings table not yet built
  notes                 text,

  -- timing
  checked_out_at        timestamptz not null default now(),
  expected_return_at    timestamptz,
  returned_at           timestamptz,
  returned_condition    text
                          check (returned_condition in ('good','damaged','lost') or returned_condition is null),

  checked_out_by        uuid not null references public.user_profiles(id) on delete restrict,
  checked_in_by         uuid references public.user_profiles(id) on delete set null,

  created_at            timestamptz not null default now(),

  -- a holder must be identified one way or another
  check (
    held_by_user_id is not null or
    (held_by_contact_name is not null and length(trim(held_by_contact_name)) > 0)
  )
);

create index if not exists key_assignments_key_idx
  on public.key_assignments(key_id);
create index if not exists key_assignments_tenant_idx
  on public.key_assignments(tenant_id);
create index if not exists key_assignments_open_idx
  on public.key_assignments(key_id)
  where returned_at is null;
create index if not exists key_assignments_tenant_open_idx
  on public.key_assignments(tenant_id)
  where returned_at is null;

-- ─── RLS ───────────────────────────────────────────────────
alter table public.keys             enable row level security;
alter table public.key_assignments  enable row level security;

drop policy if exists "keys select" on public.keys;
create policy "keys select" on public.keys
  for select using (tenant_id = current_tenant_id());

drop policy if exists "keys insert" on public.keys;
create policy "keys insert" on public.keys
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "keys update" on public.keys;
create policy "keys update" on public.keys
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "keys delete" on public.keys;
create policy "keys delete" on public.keys
  for delete using (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "key_assignments select" on public.key_assignments;
create policy "key_assignments select" on public.key_assignments
  for select using (tenant_id = current_tenant_id());

drop policy if exists "key_assignments insert" on public.key_assignments;
create policy "key_assignments insert" on public.key_assignments
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "key_assignments update" on public.key_assignments;
create policy "key_assignments update" on public.key_assignments
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "key_assignments delete" on public.key_assignments;
create policy "key_assignments delete" on public.key_assignments
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ─── Touch updated_at on keys ──────────────────────────────
create or replace function public.keys_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists keys_set_updated_at on public.keys;
create trigger keys_set_updated_at
before update on public.keys
for each row execute function public.keys_touch_updated_at();
