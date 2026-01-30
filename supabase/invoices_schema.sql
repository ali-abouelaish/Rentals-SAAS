create table if not exists billing_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  sender_company_name text not null,
  sender_address text,
  sender_email text,
  sender_phone text,
  bank_account_holder_name text not null,
  bank_account_number text not null,
  bank_sort_code text not null,
  logo_url text,
  default_payment_terms_days int not null default 7,
  footer_thank_you_text text not null default 'Thank you for your business!',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  billing_profile_id uuid not null references billing_profiles(id),
  landlord_id uuid not null references landlords(id),
  invoice_number text not null,
  issue_date date not null default current_date,
  payment_terms_days int not null default 7,
  due_date date not null,
  status text not null check (status in ('draft','submitted','approved','sent','paid','declined','void')),
  created_by_user_id uuid not null references user_profiles(id),
  approved_by_user_id uuid references user_profiles(id),
  notes text,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  pdf_storage_path text,
  submitted_at timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  paid_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order int not null default 0
);

create table if not exists invoice_bonus_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  bonus_id uuid not null references bonuses(id),
  unique (invoice_id, bonus_id)
);

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table if not exists tenant_invoice_counter (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  current_value integer not null default 0
);

alter table bonuses
  add column if not exists code text;

alter table bonuses
  add column if not exists landlord_id uuid references landlords(id);

alter table bonuses
  add column if not exists amount_owed numeric(12,2);

alter table bonuses
  add column if not exists status text default 'pending';

alter table bonuses
  add column if not exists invoice_id uuid references invoices(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bonuses_status_check'
  ) then
    alter table bonuses
      add constraint bonuses_status_check
      check (status in ('pending','approved','sent','paid','declined'));
  end if;
end $$;

create index if not exists idx_invoices_tenant on invoices(tenant_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoice_items_invoice on invoice_items(invoice_id);
create index if not exists idx_invoice_bonus_links_invoice on invoice_bonus_links(invoice_id);
