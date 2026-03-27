-- Phase 2 RLS Policies
-- Covers: pm_tenants, guarantors, property_contracts, booking_forms,
--         form_questions, bookings, form_responses

-- ============================================================
-- Enable RLS
-- ============================================================
alter table public.pm_tenants enable row level security;
alter table public.guarantors enable row level security;
alter table public.property_contracts enable row level security;
alter table public.booking_forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.bookings enable row level security;
alter table public.form_responses enable row level security;

-- ============================================================
-- pm_tenants
-- ============================================================
create policy "pm_tenants select"
  on public.pm_tenants for select
  using (tenant_id = current_tenant_id());

create policy "pm_tenants insert"
  on public.pm_tenants for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "pm_tenants update"
  on public.pm_tenants for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "pm_tenants delete"
  on public.pm_tenants for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- guarantors
-- ============================================================
create policy "guarantors select"
  on public.guarantors for select
  using (tenant_id = current_tenant_id());

create policy "guarantors insert"
  on public.guarantors for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "guarantors update"
  on public.guarantors for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "guarantors delete"
  on public.guarantors for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- property_contracts
-- ============================================================
create policy "property_contracts select"
  on public.property_contracts for select
  using (tenant_id = current_tenant_id());

create policy "property_contracts insert"
  on public.property_contracts for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "property_contracts update"
  on public.property_contracts for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "property_contracts delete"
  on public.property_contracts for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- booking_forms
-- Authenticated users see their tenant's forms.
-- Public can read active forms (needed to render /apply/[slug]).
-- ============================================================
create policy "booking_forms select authenticated"
  on public.booking_forms for select
  using (tenant_id = current_tenant_id());

create policy "booking_forms select public active"
  on public.booking_forms for select
  using (is_active = true);

create policy "booking_forms insert"
  on public.booking_forms for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "booking_forms update"
  on public.booking_forms for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "booking_forms delete"
  on public.booking_forms for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- form_questions
-- Public SELECT needed so the /apply/[slug] page can render questions.
-- ============================================================
create policy "form_questions select"
  on public.form_questions for select
  using (true);

create policy "form_questions insert"
  on public.form_questions for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "form_questions update"
  on public.form_questions for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "form_questions delete"
  on public.form_questions for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- bookings
-- Authenticated: see your tenant's bookings.
-- Public insert handled via admin client in server action (bypasses RLS).
-- ============================================================
create policy "bookings select"
  on public.bookings for select
  using (tenant_id = current_tenant_id());

create policy "bookings insert"
  on public.bookings for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "bookings update"
  on public.bookings for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "bookings delete"
  on public.bookings for delete
  using (tenant_id = current_tenant_id() and is_admin());

-- ============================================================
-- form_responses
-- Same pattern as bookings — admin client used for public inserts.
-- ============================================================
create policy "form_responses select"
  on public.form_responses for select
  using (tenant_id = current_tenant_id());

create policy "form_responses insert"
  on public.form_responses for insert
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "form_responses update"
  on public.form_responses for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy "form_responses delete"
  on public.form_responses for delete
  using (tenant_id = current_tenant_id() and is_admin());
