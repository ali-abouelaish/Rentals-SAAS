-- ============================================================
-- Bank Statements refactor: scope uploads by portfolio (not landlord),
-- group missing-rent flags by landlord within that portfolio, and
-- denormalize matched contract details onto bank_transactions so the
-- transaction feed can show the full mapping without joining.
-- ============================================================

-- ─── bank_statement_uploads: landlord → portfolio scoping ──
alter table public.bank_statement_uploads
  drop constraint if exists bank_statement_uploads_manager_landlord_id_fkey;

alter table public.bank_statement_uploads
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

drop index if exists bank_statement_uploads_landlord_idx;

alter table public.bank_statement_uploads
  drop column if exists manager_landlord_id;

create index if not exists bank_statement_uploads_portfolio_idx
  on public.bank_statement_uploads(portfolio_id);

-- ─── rent_payment_flags: landlord_name for grouping by landlord ──
alter table public.rent_payment_flags
  add column if not exists landlord_name text;

-- ─── bank_transactions: matched contract details ──
-- Denormalized so the transaction feed shows the address and expected
-- amount for every match without a join. Re-uploading repopulates them
-- for older rows; existing matches stay correct but show "—" for these
-- two fields until reparsed.
alter table public.bank_transactions
  add column if not exists matched_property_address text;

alter table public.bank_transactions
  add column if not exists matched_expected_pence integer;
