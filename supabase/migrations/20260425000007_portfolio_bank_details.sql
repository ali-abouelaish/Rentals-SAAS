-- Move bank details from per-booking-form to per-portfolio.
-- Each portfolio can now own many bank accounts (1:N), with one flagged as
-- default. Booking forms inherit the portfolio's default unless they pick a
-- specific one via booking_forms.bank_details_id.

-- 1. New table: portfolio-scoped bank details.
create table if not exists public.portfolio_bank_details (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  label text not null default 'Main account',
  account_holder_name text,
  account_number text,
  sort_code text,
  bank_name text,
  payment_reference_hint text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_bank_details_tenant_idx
  on public.portfolio_bank_details (tenant_id);
create index if not exists portfolio_bank_details_portfolio_idx
  on public.portfolio_bank_details (portfolio_id);

-- At most one default per portfolio.
create unique index if not exists portfolio_bank_details_default_unique
  on public.portfolio_bank_details (portfolio_id) where is_default;

alter table public.portfolio_bank_details enable row level security;

create policy "portfolio_bank_details select"
on public.portfolio_bank_details for select
using (tenant_id = current_tenant_id());

create policy "portfolio_bank_details modify"
on public.portfolio_bank_details for all
using (tenant_id = current_tenant_id() and is_admin())
with check (tenant_id = current_tenant_id() and is_admin());

comment on table public.portfolio_bank_details is
  'Per-portfolio bank accounts. A portfolio can have many; one is_default per portfolio drives the public booking-form payment block unless the form overrides.';

-- 2. Per-form override pointer (nullable → fall back to portfolio default).
alter table public.booking_forms
  add column if not exists bank_details_id uuid
  references public.portfolio_bank_details(id) on delete set null;

create index if not exists booking_forms_bank_details_idx
  on public.booking_forms (bank_details_id);

-- 3. Backfill: each existing booking_form_bank_details row → one portfolio_bank_details
--    row scoped to that form's portfolio. If multiple forms share a portfolio, take
--    the most recently updated row as the portfolio's default; the rest become
--    additional accounts labelled by their form name.
do $$
declare
  rec record;
  new_id uuid;
  default_assigned boolean;
begin
  -- Iterate portfolio-by-portfolio so we can deterministically pick a default per portfolio.
  for rec in
    select bd.*, f.portfolio_id, f.name as form_name
      from public.booking_form_bank_details bd
      join public.booking_forms f on f.id = bd.form_id
     where f.portfolio_id is not null
     order by f.portfolio_id, bd.updated_at desc
  loop
    select exists (
      select 1 from public.portfolio_bank_details pbd
       where pbd.portfolio_id = rec.portfolio_id and pbd.is_default
    ) into default_assigned;

    insert into public.portfolio_bank_details (
      tenant_id, portfolio_id, label,
      account_holder_name, account_number, sort_code, bank_name,
      payment_reference_hint, is_default, updated_at
    )
    values (
      rec.tenant_id, rec.portfolio_id,
      case when default_assigned then rec.form_name else 'Main account' end,
      rec.account_holder_name, rec.account_number, rec.sort_code, rec.bank_name,
      rec.payment_reference_hint, not default_assigned, rec.updated_at
    )
    returning id into new_id;

    update public.booking_forms set bank_details_id = new_id where id = rec.form_id;
  end loop;
end $$;

-- 4. Drop the old per-form table — fully replaced by the portfolio-scoped model.
drop table if exists public.booking_form_bank_details;
