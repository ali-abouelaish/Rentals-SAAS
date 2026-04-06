-- Add per-property contract fields to properties table
alter table public.properties
  add column if not exists contract_start_date   date,
  add column if not exists contract_expiry_date  date,
  add column if not exists monthly_rent_owed     numeric(10,2),
  add column if not exists payment_schedule      text check (payment_schedule in ('monthly','quarterly','biannual','annual')),
  add column if not exists contract_document_url text;

-- Storage bucket for property contract documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property_contracts',
  'property_contracts',
  true,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public               = true,
      file_size_limit      = 20971520,
      allowed_mime_types   = array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

drop policy if exists "property_contracts read" on storage.objects;
create policy "property_contracts read"
on storage.objects for select
using (bucket_id = 'property_contracts');

drop policy if exists "property_contracts insert" on storage.objects;
create policy "property_contracts insert"
on storage.objects for insert
with check (
  bucket_id = 'property_contracts'
  and (select auth.uid()) is not null
);

drop policy if exists "property_contracts update" on storage.objects;
create policy "property_contracts update"
on storage.objects for update
using (
  bucket_id = 'property_contracts'
  and (select auth.uid()) is not null
);

drop policy if exists "property_contracts delete" on storage.objects;
create policy "property_contracts delete"
on storage.objects for delete
using (
  bucket_id = 'property_contracts'
  and (select auth.uid()) is not null
);
