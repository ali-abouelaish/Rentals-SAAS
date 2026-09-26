-- Platform invoices: a document, a number, and a record of it being sent.
--
-- Three gaps this closes:
--
--   1. NO INVOICE NUMBER. An invoice without a reference is not something an
--      agency can quote at us or put through their own books, and a UK VAT
--      invoice must carry a unique, sequential number. Assigned at ISSUE, not
--      at generation: drafts get rebuilt and voided routinely, and burning a
--      number on each one would leave gaps in a sequence that is supposed not
--      to have any.
--   2. NO PDF. The figures existed only inside the admin screen.
--   3. NO RECORD OF SENDING. Nothing distinguished an invoice the agency has
--      received from one sitting unsent, which is the difference between
--      chasing a payment and chasing nothing.

-- ============================================================
-- 1. The number sequence
-- ============================================================
-- A real sequence rather than max()+1. Two issues happening together would
-- otherwise read the same maximum and mint the same number, and duplicate
-- invoice numbers are precisely what the sequence requirement exists to
-- prevent.
create sequence if not exists public.platform_invoice_number_seq start 1;

alter table public.tenant_platform_invoices
  add column if not exists invoice_number text;

-- Unique where present. Drafts carry null until issued, and many nulls are
-- fine — a partial index keeps the constraint meaningful without forcing a
-- number onto documents that may never become invoices.
create unique index if not exists tenant_platform_invoices_number_key
  on public.tenant_platform_invoices (invoice_number)
  where invoice_number is not null;

comment on column public.tenant_platform_invoices.invoice_number is
  'Sequential reference, e.g. HO-2026-00042. Assigned once, at issue. Null on drafts.';

-- ============================================================
-- 2. The document and its delivery
-- ============================================================
alter table public.tenant_platform_invoices
  add column if not exists pdf_storage_path text;

alter table public.tenant_platform_invoices
  add column if not exists emailed_at timestamptz;

alter table public.tenant_platform_invoices
  add column if not exists emailed_to text;

alter table public.tenant_platform_invoices
  add column if not exists email_error text;

comment on column public.tenant_platform_invoices.pdf_storage_path is
  'Path in the private platform-invoices bucket. Regenerated on demand if missing, so it is a cache rather than a source of truth.';

comment on column public.tenant_platform_invoices.emailed_to is
  'The address the invoice was actually sent to, recorded because the billing contact can change afterwards and "we sent it to you" needs to survive that.';

-- ============================================================
-- 3. Issue atomically, and mint the number in the same statement
-- ============================================================
-- Issuing was an UPDATE ... WHERE status = 'draft' from application code. That
-- is safe on its own, but the number has to be assigned in the same statement:
-- issuing and numbering as two steps leaves a window where an invoice is issued
-- with no reference, and a retry would mint a second number for it.
--
-- Returns the row so the caller can report the number it actually got.
create or replace function public.issue_platform_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_number text;
  v_existing text;
  v_status text;
begin
  select status, invoice_number into v_status, v_existing
  from public.tenant_platform_invoices
  where id = p_invoice_id
  for update;

  if v_status is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_status <> 'draft' then
    return jsonb_build_object('ok', false, 'reason', 'not_draft', 'status', v_status);
  end if;

  -- Re-issuing something that already carries a number must not mint another.
  -- Shouldn't be reachable given the draft check, but a number is permanent and
  -- worth defending twice.
  v_number := coalesce(
    v_existing,
    'HO-' || to_char(now() at time zone 'utc', 'YYYY') || '-' ||
      lpad(nextval('public.platform_invoice_number_seq')::text, 5, '0')
  );

  update public.tenant_platform_invoices
  set status = 'issued',
      issued_at = now(),
      invoice_number = v_number
  where id = p_invoice_id;

  return jsonb_build_object('ok', true, 'invoice_number', v_number);
end;
$$;

comment on function public.issue_platform_invoice(uuid) is
  'Move a draft invoice to issued and assign its sequential number in one statement. Returns {ok, invoice_number} or {ok:false, reason}.';
