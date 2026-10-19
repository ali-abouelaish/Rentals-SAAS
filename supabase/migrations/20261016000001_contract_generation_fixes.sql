-- ============================================================
-- Contract generation fixes (review of 2026-10-16)
-- ============================================================
-- 1. The property_contracts storage bucket was public, with a read policy open
--    to every role (anon included) and write/delete policies that only asked
--    for a logged-in user. Tenancy agreements carry tenants' names, addresses
--    and rent, and the anon key ships in the browser bundle, so anyone could
--    list and download every agency's contracts, and any agency's user could
--    overwrite or delete another's. The bucket becomes private, with policies
--    scoped to the agency's own path prefix; documents are served through
--    authorised app routes that mint a short-lived signed URL per click.
--
-- 2. document_url used to hold either a public URL or a one-hour signed URL
--    (dead an hour after generation). It now holds a stable app route, and the
--    storage location moves to document_bucket + document_path. Existing rows
--    are rewritten below so every link keeps working once the bucket is private.
--
-- 3. Regeneration lost the expiry date and every manually entered field because
--    the inputs were never stored. generation_inputs keeps them; generated_fields
--    snapshots the template's fields at generation time so signature boxes are
--    placed on the PDF they were generated for, not on the template as it is now.
--
-- 4. A 'contract' field source, so templates can stamp the agreed terms (start,
--    expiry, rent, deposit, rent day, scheme) rather than unit listing prices.
-- ============================================================

-- ─── 2/3. New columns ─────────────────────────────────────────
alter table public.property_contracts
  add column if not exists document_bucket text,
  add column if not exists document_path text,
  add column if not exists generation_inputs jsonb,
  add column if not exists generated_fields jsonb;

comment on column public.property_contracts.document_bucket is
  'Storage bucket holding the current contract document (property_contracts or signed_documents).';
comment on column public.property_contracts.document_path is
  'Storage path of the current contract document. document_url points at /api/contracts/{id}/document, which signs this on demand.';
comment on column public.property_contracts.generation_inputs is
  'Terms and manual field values the PDF was last generated with, so regeneration is lossless.';
comment on column public.property_contracts.generated_fields is
  'Snapshot of the template fields used for the last generation; signature boxes are sent from this.';

alter table public.properties
  add column if not exists contract_document_path text;

comment on column public.properties.contract_document_path is
  'Storage path (property_contracts bucket) of the uploaded landlord contract. contract_document_url points at /api/properties/{id}/contract-document.';

-- ─── 4. 'contract' field source ───────────────────────────────
-- The original inline CHECK was auto-named; find it by definition rather than
-- trusting the generated name, so the old list can't survive and reject 'contract'.
do $$
declare cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.contract_template_fields'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%booking_response%'
  loop
    execute format('alter table public.contract_template_fields drop constraint %I', cname);
  end loop;
end $$;

alter table public.contract_template_fields
  add constraint contract_template_fields_source_check
  check (source is null or source in (
    'booking_response','property','unit','landlord',
    'agency','booking','pm_tenant','manual','computed','contract'
  ));

-- ─── 2. Rewrite existing storage URLs to stable routes ────────
-- Storage URLs are percent-encoded; paths are stored decoded. Temporary helper,
-- dropped at the end of this migration.
create or replace function public._tmp_url_decode(input text)
returns text
language plpgsql
immutable
as $$
declare
  bin bytea := '';
  part text;
begin
  for part in select (regexp_matches(input, '(%[0-9A-Fa-f]{2}|.)', 'g'))[1] loop
    if length(part) = 3 and left(part, 1) = '%' then
      bin := bin || decode(substring(part from 2 for 2), 'hex');
    else
      bin := bin || convert_to(part, 'utf8');
    end if;
  end loop;
  return convert_from(bin, 'utf8');
end;
$$;

update public.property_contracts
set document_bucket = 'property_contracts',
    document_path = public._tmp_url_decode(
      substring(document_url from '/storage/v1/object/(?:public|sign|authenticated)/property_contracts/([^?#]+)')
    ),
    document_url = '/api/contracts/' || id || '/document'
where document_url ~ '/storage/v1/object/(public|sign|authenticated)/property_contracts/';

-- Generated contracts whose link was never set (or was replaced by hand with
-- nothing) still have their PDF; point them at it.
update public.property_contracts
set document_bucket = 'property_contracts',
    document_path = generated_pdf_path,
    document_url = '/api/contracts/' || id || '/document'
where generated_pdf_path is not null
  and document_path is null
  and (document_url is null or document_url = '');

update public.properties
set contract_document_path = public._tmp_url_decode(
      substring(contract_document_url from '/storage/v1/object/(?:public|sign|authenticated)/property_contracts/([^?#]+)')
    ),
    contract_document_url = '/api/properties/' || id || '/contract-document'
where contract_document_url ~ '/storage/v1/object/(public|sign|authenticated)/property_contracts/';

drop function public._tmp_url_decode(text);

-- ─── 1. Private bucket, agency-scoped policies ────────────────
update storage.buckets set public = false where id = 'property_contracts';

drop policy if exists "property_contracts read"   on storage.objects;
drop policy if exists "property_contracts insert" on storage.objects;
drop policy if exists "property_contracts update" on storage.objects;
drop policy if exists "property_contracts delete" on storage.objects;

-- Text comparison, not ::uuid — legacy objects live under non-uuid prefixes
-- (e.g. tmp/), and a failing cast would error the whole listing. Those legacy
-- objects stay reachable through the app routes, which use the service role
-- after checking the owning row under RLS.
create policy "property_contracts read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'property_contracts'
    and (storage.foldername(name))[1] = (select current_tenant_id())::text
  );

create policy "property_contracts insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property_contracts'
    and (storage.foldername(name))[1] = (select current_tenant_id())::text
    and (select is_admin())
  );

create policy "property_contracts update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'property_contracts'
    and (storage.foldername(name))[1] = (select current_tenant_id())::text
    and (select is_admin())
  )
  with check (
    bucket_id = 'property_contracts'
    and (storage.foldername(name))[1] = (select current_tenant_id())::text
    and (select is_admin())
  );

create policy "property_contracts delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'property_contracts'
    and (storage.foldername(name))[1] = (select current_tenant_id())::text
    and (select is_admin())
  );
