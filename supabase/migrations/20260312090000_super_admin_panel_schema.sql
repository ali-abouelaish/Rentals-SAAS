-- Super admin panel support schema
-- Adds tenant metadata + branding + profile/permission scaffolding.

alter table public.tenants
  add column if not exists slug text,
  add column if not exists status text not null default 'active';

-- Backfill slug for existing rows using a deterministic fallback.
update public.tenants
set slug = coalesce(
  nullif(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), ''),
  concat('tenant-', substring(id::text, 1, 8))
)
where slug is null;

alter table public.tenants
  alter column slug set not null;

create unique index if not exists tenants_slug_key on public.tenants (slug);
create index if not exists idx_tenants_status on public.tenants (status);

create table if not exists public.tenant_branding_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  brand_name text,
  logo_url text,
  primary_color text default '#0B2F59',
  secondary_color text default '#6BB0D0',
  accent_color text default '#4FD1FF',
  theme_mode text not null default 'light' check (theme_mode in ('light', 'dark', 'system')),
  font_family text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_access_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  permissions jsonb not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.user_profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists profile_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'user_profiles_profile_id_fkey'
      and table_name = 'user_profiles'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_profile_id_fkey
      foreign key (profile_id) references public.tenant_access_profiles(id) on delete set null;
  end if;
end $$;

create index if not exists idx_user_profiles_tenant_active on public.user_profiles (tenant_id, is_active);
create index if not exists idx_user_profiles_profile_id on public.user_profiles (profile_id);
create index if not exists idx_tenant_access_profiles_tenant on public.tenant_access_profiles (tenant_id);
create index if not exists idx_activity_log_tenant_action_created on public.activity_log (tenant_id, action, created_at desc);

