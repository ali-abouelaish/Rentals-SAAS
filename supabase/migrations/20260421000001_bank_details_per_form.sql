-- Move bank details from tenant-wide to per-booking-form.
-- Each booking form now has its own bank account info, so applicants see the
-- right payment destination for the portfolio they are applying through.

-- 1. New table keyed by form_id
create table if not exists public.booking_form_bank_details (
  form_id uuid primary key references public.booking_forms(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  account_holder_name text,
  account_number text,
  sort_code text,
  bank_name text,
  payment_reference_hint text,
  updated_at timestamptz not null default now()
);

create index if not exists booking_form_bank_details_tenant_idx
  on public.booking_form_bank_details (tenant_id);

alter table public.booking_form_bank_details enable row level security;

create policy "booking_form_bank_details select"
on public.booking_form_bank_details for select
using (tenant_id = current_tenant_id());

create policy "booking_form_bank_details modify"
on public.booking_form_bank_details for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

comment on table public.booking_form_bank_details is
  'Per-booking-form bank account details shown on public /apply pages so applicants know where to pay the holding deposit.';

-- 2. Backfill: copy existing tenant-wide bank details onto every booking form
--    in the same tenant, so nothing goes missing after the cutover.
insert into public.booking_form_bank_details (
  form_id,
  tenant_id,
  account_holder_name,
  account_number,
  sort_code,
  bank_name,
  payment_reference_hint,
  updated_at
)
select
  f.id,
  f.tenant_id,
  t.account_holder_name,
  t.account_number,
  t.sort_code,
  t.bank_name,
  t.payment_reference_hint,
  t.updated_at
from public.booking_forms f
join public.tenant_bank_details t on t.tenant_id = f.tenant_id
on conflict (form_id) do nothing;

-- 3. Drop the old tenant-wide table — fully replaced by the per-form model.
drop table if exists public.tenant_bank_details;
