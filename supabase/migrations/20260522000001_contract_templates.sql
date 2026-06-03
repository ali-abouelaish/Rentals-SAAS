-- ============================================================
-- Contract Templates — dynamic contract PDF generation
-- ============================================================
-- Lets each agency upload their own tenancy contract PDF once,
-- visually mark dynamic-data regions, and re-stamp them with
-- booking + property + landlord + agency data at generation time.
-- ============================================================

-- ─── contract_templates ───────────────────────────────────
create table if not exists public.contract_templates (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  description     text,
  portfolio_id    uuid references public.portfolios(id) on delete set null,
  source_pdf_path text not null,
  page_count      integer not null,
  page_sizes      jsonb not null,
  created_by      uuid references public.user_profiles(id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists contract_templates_tenant_active_idx
  on public.contract_templates(tenant_id, is_active);
create index if not exists contract_templates_tenant_portfolio_idx
  on public.contract_templates(tenant_id, portfolio_id);

-- ─── contract_template_fields ─────────────────────────────
create table if not exists public.contract_template_fields (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  template_id       uuid not null references public.contract_templates(id) on delete cascade,
  label             text not null,
  page_index        integer not null check (page_index >= 0),

  -- Bounding box in PDF points, top-left origin (converted at draw time)
  x                 numeric not null,
  y                 numeric not null,
  width             numeric not null check (width > 0),
  height            numeric not null check (height > 0),

  source            text not null check (source in (
                      'booking_response','property','unit','landlord',
                      'agency','booking','pm_tenant','manual','computed'
                    )),
  question_id       uuid references public.form_questions(id) on delete set null,
  data_key          text,
  manual_key        text,
  manual_default    text,

  format            text not null default 'text'
                      check (format in ('text','date','currency_gbp','number','multiline')),
  font_size         numeric not null default 10 check (font_size between 4 and 48),
  font_weight       text not null default 'normal' check (font_weight in ('normal','bold')),
  text_align        text not null default 'left' check (text_align in ('left','center','right')),
  truncate_overflow boolean not null default true,
  ai_confidence     numeric check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  sort_order        integer not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists contract_template_fields_template_idx
  on public.contract_template_fields(template_id, page_index);
create index if not exists contract_template_fields_tenant_idx
  on public.contract_template_fields(tenant_id);

-- ─── Extend property_contracts ────────────────────────────
alter table public.property_contracts
  add column if not exists template_id uuid references public.contract_templates(id) on delete set null;
alter table public.property_contracts
  add column if not exists generated_from_booking_id uuid references public.bookings(id) on delete set null;
alter table public.property_contracts
  add column if not exists generated_pdf_path text;
alter table public.property_contracts
  add column if not exists last_generated_at timestamptz;

create index if not exists property_contracts_template_idx
  on public.property_contracts(template_id);
create index if not exists property_contracts_generated_booking_idx
  on public.property_contracts(generated_from_booking_id);

-- ─── RLS ──────────────────────────────────────────────────
alter table public.contract_templates       enable row level security;
alter table public.contract_template_fields enable row level security;

drop policy if exists "contract_templates select" on public.contract_templates;
create policy "contract_templates select" on public.contract_templates
  for select using (tenant_id = current_tenant_id());

drop policy if exists "contract_templates insert" on public.contract_templates;
create policy "contract_templates insert" on public.contract_templates
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "contract_templates update" on public.contract_templates;
create policy "contract_templates update" on public.contract_templates
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "contract_templates delete" on public.contract_templates;
create policy "contract_templates delete" on public.contract_templates
  for delete using (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "contract_template_fields select" on public.contract_template_fields;
create policy "contract_template_fields select" on public.contract_template_fields
  for select using (tenant_id = current_tenant_id());

drop policy if exists "contract_template_fields insert" on public.contract_template_fields;
create policy "contract_template_fields insert" on public.contract_template_fields
  for insert with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "contract_template_fields update" on public.contract_template_fields;
create policy "contract_template_fields update" on public.contract_template_fields
  for update using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

drop policy if exists "contract_template_fields delete" on public.contract_template_fields;
create policy "contract_template_fields delete" on public.contract_template_fields
  for delete using (tenant_id = current_tenant_id() and is_admin());

-- ─── updated_at triggers ──────────────────────────────────
create or replace function public.contract_templates_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contract_templates_set_updated_at on public.contract_templates;
create trigger contract_templates_set_updated_at
before update on public.contract_templates
for each row execute function public.contract_templates_touch_updated_at();

drop trigger if exists contract_template_fields_set_updated_at on public.contract_template_fields;
create trigger contract_template_fields_set_updated_at
before update on public.contract_template_fields
for each row execute function public.contract_templates_touch_updated_at();
