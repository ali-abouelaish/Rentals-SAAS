-- BoldSign e-signing: signature fields on contract templates.
--
-- Agencies already place merge fields on their own AST visually in the template
-- editor, and those boxes are stored here in PDF points with a top-left origin
-- — exactly the shape BoldSign's form fields take. So a signature box is not a
-- new mechanism, just a new kind of field on the existing canvas.
--
-- Two columns:
--   field_kind  — 'data' (the existing behaviour: resolve a value and stamp it
--                 into the PDF) or one of the e-signature kinds, which are NOT
--                 stamped and instead become BoldSign fields at send time.
--   signer_role — which party signs it. A tenancy has at least two signatories,
--                 so a signature box is meaningless without knowing whose it is.
--
-- `source` becomes nullable because a signature field binds to no data. The
-- shape constraint keeps each kind honest: data fields still need a source,
-- signature fields still need a signer.

alter table public.contract_template_fields
  add column if not exists field_kind text not null default 'data'
    check (field_kind in ('data', 'signature', 'initial', 'date_signed'));

alter table public.contract_template_fields
  add column if not exists signer_role text
    check (signer_role in ('tenant', 'landlord', 'guarantor'));

-- Existing rows are all data fields and already have a source, so dropping the
-- NOT NULL cannot invalidate anything already stored.
alter table public.contract_template_fields
  alter column source drop not null;

alter table public.contract_template_fields
  drop constraint if exists contract_template_fields_binding_shape;

alter table public.contract_template_fields
  add constraint contract_template_fields_binding_shape
  check (
    (field_kind = 'data' and source is not null)
    or (field_kind <> 'data' and signer_role is not null)
  );

-- Send-time lookup is "give me this template's signature fields", so index the
-- non-data rows only — they are a small minority of a template's fields.
create index if not exists contract_template_fields_signature_idx
  on public.contract_template_fields (template_id, signer_role)
  where field_kind <> 'data';

comment on column public.contract_template_fields.field_kind is
  'data = merge field stamped into the PDF; signature/initial/date_signed = e-signature field placed by BoldSign at send time.';
comment on column public.contract_template_fields.signer_role is
  'Which party signs this field. Required for e-signature kinds, null for data fields.';
