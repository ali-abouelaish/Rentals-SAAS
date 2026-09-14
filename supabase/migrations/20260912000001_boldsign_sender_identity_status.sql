-- BoldSign phase 5: record WHY a sender identity isn't usable.
--
-- `sender_identity_verified_at` says an identity is verified. It cannot say
-- anything about one that is not: a request awaiting the agency's click and a
-- request the agency actively declined both read as null, and the UI has to
-- tell those apart — one means "check your inbox", the other means "you said
-- no, do you want to try again".
--
-- The value is BoldSign's own status string, stored raw rather than mapped to
-- our own enum. Their vocabulary is undocumented and may gain values; mapping
-- at read time means an unrecognised one degrades to "not verified" instead of
-- violating a CHECK constraint and failing the write that recorded it.

alter table public.boldsign_agency_brands
  add column if not exists sender_identity_status text;

comment on column public.boldsign_agency_brands.sender_identity_status is
  'Raw status string from BoldSign for the sender identity (e.g. Pending, Approved, Declined). Null when no identity has been requested. Mapped defensively at read time — only an explicit approved state counts as verified.';

-- When the identity was requested, so the UI can say "sent 3 days ago" and
-- decide whether offering a resend is reasonable yet.
alter table public.boldsign_agency_brands
  add column if not exists sender_identity_requested_at timestamptz;

comment on column public.boldsign_agency_brands.sender_identity_requested_at is
  'When the verification invitation was last sent to the agency mailbox.';
