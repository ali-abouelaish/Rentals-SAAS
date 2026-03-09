-- Add agency name, contact number, and optional alphanumeric share code to clients
alter table clients
  add column if not exists agency_name text,
  add column if not exists contact_number text,
  add column if not exists share_code text;

comment on column clients.share_code is 'Optional alphanumeric share code';
