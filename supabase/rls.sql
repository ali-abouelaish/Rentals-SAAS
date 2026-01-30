-- Drop policies for idempotent re-run
drop policy if exists "tenant can view profiles" on user_profiles;
drop policy if exists "tenant can insert profiles" on user_profiles;
drop policy if exists "tenant can update own profile" on user_profiles;
drop policy if exists "tenant can view agents" on agent_profiles;
drop policy if exists "tenant can update agents" on agent_profiles;
drop policy if exists "tenant can insert agents" on agent_profiles;
drop policy if exists "clients select" on clients;
drop policy if exists "clients insert" on clients;
drop policy if exists "clients update" on clients;
drop policy if exists "rentals select" on rental_codes;
drop policy if exists "rentals insert" on rental_codes;
drop policy if exists "rentals update" on rental_codes;
drop policy if exists "landlords select" on landlords;
drop policy if exists "listings select" on listings_scraped;
drop policy if exists "bonuses select" on bonuses;
drop policy if exists "bonuses insert" on bonuses;
drop policy if exists "bonuses update" on bonuses;
drop policy if exists "document sets select" on document_sets;
drop policy if exists "document sets insert" on document_sets;
drop policy if exists "documents select" on documents;
drop policy if exists "documents insert" on documents;
drop policy if exists "ledger select" on ledger_entries;
drop policy if exists "ledger insert" on ledger_entries;
drop policy if exists "activity select" on activity_log;
drop policy if exists "activity insert" on activity_log;
drop policy if exists "tenant select" on tenants;
drop policy if exists "tenant insert" on tenants;
drop policy if exists "tenant counter select" on tenant_rental_code_counter;
drop policy if exists "tenant counter update" on tenant_rental_code_counter;
drop policy if exists "tenant counter insert" on tenant_rental_code_counter;
drop policy if exists "avatars read" on storage.objects;
drop policy if exists "avatars write" on storage.objects;
drop policy if exists "rental docs read" on storage.objects;
drop policy if exists "rental docs write" on storage.objects;

create or replace function current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select tenant_id from public.user_profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists(select 1 from public.user_profiles where id = auth.uid() and lower(role) = 'admin');
$$;

alter table user_profiles enable row level security;
alter table agent_profiles enable row level security;
alter table clients enable row level security;
alter table rental_codes enable row level security;
alter table landlords enable row level security;
alter table listings_scraped enable row level security;
alter table bonuses enable row level security;
alter table document_sets enable row level security;
alter table documents enable row level security;
alter table ledger_entries enable row level security;
alter table activity_log enable row level security;
alter table tenants enable row level security;
alter table tenant_rental_code_counter enable row level security;

create policy "tenant can view profiles"
on user_profiles for select
using (tenant_id = current_tenant_id());

create policy "tenant can insert profiles"
on user_profiles for insert
with check (tenant_id = current_tenant_id());

create policy "tenant can update own profile"
on user_profiles for update
using (id = auth.uid());

create policy "tenant can view agents"
on agent_profiles for select
using (tenant_id = current_tenant_id());

create policy "tenant can update agents"
on agent_profiles for update
using (tenant_id = current_tenant_id() and is_admin());

create policy "tenant can insert agents"
on agent_profiles for insert
with check (tenant_id = current_tenant_id());

create policy "clients select"
on clients for select
using (
  tenant_id = current_tenant_id()
  and (is_admin() or assigned_agent_id = auth.uid())
);

create policy "clients insert"
on clients for insert
with check (
  tenant_id = current_tenant_id()
  and (is_admin() or assigned_agent_id = auth.uid())
);

create policy "clients update"
on clients for update
using (
  tenant_id = current_tenant_id()
  and (is_admin() or assigned_agent_id = auth.uid())
);

create policy "rentals select"
on rental_codes for select
using (
  tenant_id = current_tenant_id()
  and (is_admin() or assisted_by_agent_id = auth.uid() or marketing_agent_id = auth.uid())
);

create policy "rentals insert"
on rental_codes for insert
with check (
  tenant_id = current_tenant_id()
  and (is_admin() or assisted_by_agent_id = auth.uid())
);

create policy "rentals update"
on rental_codes for update
using (
  tenant_id = current_tenant_id()
  and (is_admin() or assisted_by_agent_id = auth.uid())
);

create policy "landlords select"
on landlords for select
using (tenant_id = current_tenant_id());

create policy "listings select"
on listings_scraped for select
using (tenant_id = current_tenant_id());

create policy "bonuses select"
on bonuses for select
using (tenant_id = current_tenant_id() and (is_admin() or agent_id = auth.uid()));

create policy "bonuses insert"
on bonuses for insert
with check (tenant_id = current_tenant_id() and agent_id = auth.uid());

create policy "bonuses update"
on bonuses for update
using (tenant_id = current_tenant_id() and is_admin());

create policy "document sets select"
on document_sets for select
using (tenant_id = current_tenant_id());

create policy "document sets insert"
on document_sets for insert
with check (tenant_id = current_tenant_id());

create policy "documents select"
on documents for select
using (tenant_id = current_tenant_id());

create policy "documents insert"
on documents for insert
with check (tenant_id = current_tenant_id());

create policy "ledger select"
on ledger_entries for select
using (tenant_id = current_tenant_id() and (is_admin() or agent_id = auth.uid()));

create policy "ledger insert"
on ledger_entries for insert
with check (tenant_id = current_tenant_id() and is_admin());

create policy "activity select"
on activity_log for select
using (tenant_id = current_tenant_id());

create policy "activity insert"
on activity_log for insert
with check (tenant_id = current_tenant_id());

create policy "tenant select"
on tenants for select
using (id = current_tenant_id());

create policy "tenant insert"
on tenants for insert
with check (true);

create policy "tenant counter select"
on tenant_rental_code_counter for select
using (tenant_id = current_tenant_id());

create policy "tenant counter update"
on tenant_rental_code_counter for update
using (tenant_id = current_tenant_id());

create policy "tenant counter insert"
on tenant_rental_code_counter for insert
with check (tenant_id = current_tenant_id());

-- Storage policies
create policy "avatars read"
on storage.objects for select
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = current_tenant_id()::text
);

create policy "avatars write"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = current_tenant_id()::text
);

create policy "rental docs read"
on storage.objects for select
using (
  bucket_id = 'rental_docs'
  and (storage.foldername(name))[1] = current_tenant_id()::text
);

create policy "rental docs write"
on storage.objects for insert
with check (
  bucket_id = 'rental_docs'
  and (storage.foldername(name))[1] = current_tenant_id()::text
);
