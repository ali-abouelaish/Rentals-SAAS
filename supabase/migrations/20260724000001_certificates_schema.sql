-- ============================================================
-- Compliance certificates for properties and units.
-- ============================================================
-- Gas safety (CP12), EICR, EPC, fire alarm, emergency lighting,
-- legionella, PAT, HMO licence. A certificate belongs to a
-- property and optionally to a specific unit (HMO room-level
-- certs). contractor_id links the issuing contractor from the
-- maintenance suppliers directory so expiry automations can
-- chase them directly. Status (valid / expiring / expired) is
-- always derived from expiry_date at read time — never stored.
-- ============================================================

-- ─── certificates ──────────────────────────────────────────
create table public.certificates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  unit_id       uuid references public.units(id) on delete set null,
  type          text not null check (type in
    ('gas_safety', 'eicr', 'epc', 'fire_alarm', 'emergency_lighting',
     'legionella', 'pat', 'hmo_licence')),
  issue_date    date not null,
  expiry_date   date not null,
  -- Storage path inside the private certificate_docs bucket (read via signed URL).
  document_url  text,
  contractor_id uuid references public.maintenance_suppliers(id) on delete set null,
  reference     text,
  notes         text,
  import_ref    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (expiry_date > issue_date)
);

create index on public.certificates (tenant_id, property_id);
create index on public.certificates (tenant_id, expiry_date);
create index on public.certificates (tenant_id, type);
create index on public.certificates (tenant_id, contractor_id);

-- Idempotent backfill matching (same convention as 20260612000001).
create unique index certificates_tenant_import_ref_key
  on public.certificates (tenant_id, import_ref)
  where import_ref is not null;

-- Search vector — feeds the global Cmd+K search via the union in
-- the global_search RPC (recreated in 20260724000004).
alter table public.certificates
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(reference, '')), 'A') ||
    setweight(to_tsvector('simple', replace(type, '_', ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) stored;

create index certificates_search_vector_idx
  on public.certificates using gin (search_vector);

create trigger certificates_touch_updated_at
  before update on public.certificates
  for each row execute function public.set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────
alter table public.certificates enable row level security;

create policy "tenant_members_select_certificates"
  on public.certificates for select
  using (tenant_id = (select current_tenant_id()));

create policy "admins_all_certificates"
  on public.certificates for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

-- ─── Storage bucket ────────────────────────────────────────
-- Private bucket — uploads happen via the admin client in server
-- actions, reads via signed URL from /api/certificates/download.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificate_docs',
  'certificate_docs',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg','image/png','image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Admins can read files scoped to their own tenant (first path
-- segment is the tenant id, same layout as form-uploads).
create policy "certificate_docs_admin_read" on storage.objects
  for select using (
    bucket_id = 'certificate_docs'
    and (storage.foldername(name))[1]::uuid = (select current_tenant_id())
    and is_admin()
  );
