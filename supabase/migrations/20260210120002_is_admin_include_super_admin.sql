-- Allow super_admin to pass is_admin() for RLS (billing, billing_profiles, etc.)

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1 from public.user_profiles
    where id = auth.uid()
      and lower(role) in ('admin', 'super_admin')
  );
$$;
