-- BoldSign e-signing, phase 2: correlation between a BoldSign document and the
-- Harbor Ops record it was raised from, plus the webhook event log that makes
-- Phase 4 handling idempotent.
--
-- Design note (docs/boldsign-integration-plan.md §0.2): the signing lifecycle
-- lives here rather than being pushed into property_contracts.status,
-- maintenance_jobs.status and owner_statements.status. Those are three separate
-- CHECK constraints, each driving its own kanban / badges / filter bar, and
-- widening all three to carry five signing states would be a large change for
-- little gain. Instead this table owns the fine-grained state and only a coarse
-- transition is mirrored back onto the host record (contract -> 'signed' on
-- completion).
--
-- Service-role access is not sufficient here: agency staff need to see signing
-- status in the UI, so RLS is tenant-scoped like public.certificates rather
-- than locked to the admin client like dps_connections (which holds secrets).

-- ============================================================
-- 1. boldsign_documents — one row per signature request.
-- ============================================================
create table if not exists public.boldsign_documents (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,

  -- The Harbor Ops record this document was raised from. Deliberately a loose
  -- (type, id) pair rather than three nullable FKs, since the three parent
  -- tables share no supertype. The trade-off is that deleting a parent leaves
  -- this row behind; that is accepted on purpose — a signature request that
  -- really was sent to a real person is worth keeping as evidence even after
  -- the contract or works order is deleted.
  entity_type           text not null
                          check (entity_type in ('contract', 'work_order', 'owner_statement')),
  entity_id             uuid not null,

  -- BoldSign's identifier, returned by POST /v1/document/send. This is what
  -- lets a webhook find its way back to this row.
  --
  -- Nullable on purpose: the row is inserted BEFORE the send call, to claim the
  -- one-active-per-entity index below, and is filled in once BoldSign responds.
  -- Reserving first is what makes the double-send guard real — two concurrent
  -- clicks collide on the index before either has sent anything, rather than
  -- after both have emailed the signer a real agreement.
  boldsign_document_id  text,

  -- Which agency identity / brand sent it (Phase 5). Null until brands are set up.
  brand_id              text,

  -- Mirrors BoldSign's own vocabulary rather than inventing a parallel one.
  -- 'failed' is ours: the send call itself errored.
  status                text not null default 'awaiting_signature'
                          check (status in (
                            'awaiting_signature',
                            'partially_signed',
                            'completed',
                            'declined',
                            'expired',
                            'revoked',
                            'failed'
                          )),

  -- Paths inside the private signed_documents bucket, populated on Completed.
  signed_pdf_path       text,
  audit_trail_path      text,

  -- Sandbox documents must never be mistaken for executed agreements.
  is_sandbox            boolean not null default true,

  sent_by               uuid references public.user_profiles(id) on delete set null,
  sent_at               timestamptz not null default now(),
  completed_at          timestamptz,
  -- Decline reason / expiry note / send error, whichever applies.
  status_detail         text,
  last_event_at         timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Unique where present, so the pre-send reservation (null id) doesn't collide
-- while a real BoldSign id still can only ever map to one row.
create unique index if not exists boldsign_documents_document_id_key
  on public.boldsign_documents (boldsign_document_id)
  where boldsign_document_id is not null;

create index if not exists boldsign_documents_entity_idx
  on public.boldsign_documents (tenant_id, entity_type, entity_id);
create index if not exists boldsign_documents_status_idx
  on public.boldsign_documents (tenant_id, status);

-- At most one signature request in flight per record. Without this a
-- double-clicked "Send for signature" button raises two real documents and the
-- signer gets two emails. Terminal states are excluded so a declined or expired
-- request can be re-sent.
create unique index if not exists boldsign_documents_one_active_per_entity
  on public.boldsign_documents (entity_type, entity_id)
  where status in ('awaiting_signature', 'partially_signed');

create trigger boldsign_documents_touch_updated_at
  before update on public.boldsign_documents
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. boldsign_document_events — webhook idempotency + audit.
-- ============================================================
-- BoldSign retries on non-2xx and may deliver the same event more than once.
-- Inserting the event id first (unique) is the guard: a duplicate delivery
-- fails the insert and the handler stops before re-processing.
--
-- Not FK-constrained to boldsign_documents: an event can arrive for a document
-- we failed to persist, and losing that evidence is worse than an orphan row.
create table if not exists public.boldsign_document_events (
  id                    uuid primary key default gen_random_uuid(),
  -- Null when the event is for a document we can't correlate (see above).
  tenant_id             uuid references public.tenants(id) on delete cascade,

  -- WebhookEvent.event.id — BoldSign's unique id for this delivery.
  event_id              text not null unique,
  event_type            text not null,
  boldsign_document_id  text,

  -- Full verified payload, kept so a failed handler can be replayed.
  payload               jsonb not null,

  received_at           timestamptz not null default now(),
  processed_at          timestamptz,
  process_error         text
);

create index if not exists boldsign_document_events_document_idx
  on public.boldsign_document_events (boldsign_document_id);
create index if not exists boldsign_document_events_unprocessed_idx
  on public.boldsign_document_events (received_at)
  where processed_at is null;

-- ============================================================
-- 3. Row Level Security.
-- ============================================================
alter table public.boldsign_documents enable row level security;

-- Staff see signing status for their own agency.
create policy "tenant_members_select_boldsign_documents"
  on public.boldsign_documents for select
  using (tenant_id = (select current_tenant_id()));

-- Writes happen in server actions and the webhook handler; admins may also
-- correct rows from the UI.
create policy "admins_all_boldsign_documents"
  on public.boldsign_documents for all
  using (tenant_id = (select current_tenant_id()) and is_admin())
  with check (tenant_id = (select current_tenant_id()) and is_admin());

alter table public.boldsign_document_events enable row level security;
-- Intentionally no policies: only the service-role admin client (the webhook
-- handler) reads or writes this table. It holds raw provider payloads and has
-- no UI surface.

-- ============================================================
-- 4. Storage bucket for signed artefacts.
-- ============================================================
-- Private. Written by the webhook handler via the admin client on Completed,
-- read through signed URLs. Paths are {tenant_id}/{boldsign_document_id}/...
-- so the tenant check below can read the prefix.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signed_documents',
  'signed_documents',
  false,
  26214400, -- 25 MB; signed PDFs carry the audit trail and embedded signatures
  array['application/pdf']
)
on conflict (id) do nothing;

create policy "signed_documents_tenant_read" on storage.objects
  for select using (
    bucket_id = 'signed_documents'
    and (storage.foldername(name))[1]::uuid = (select current_tenant_id())
  );
