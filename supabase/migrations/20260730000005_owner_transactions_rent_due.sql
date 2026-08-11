-- ============================================================
-- Add the `rent_due` owner-transaction type.
-- ============================================================
-- Owner statements previously listed each tenant's rent payment as a
-- `rent_received` line. That exposes room-level detail the landlord has no
-- business seeing (who paid, how much, when, which rooms are void) and is the
-- wrong figure anyway under a rent-to-rent deal: the agency owes the landlord
-- the agreed rent whether or not the rooms are let.
--
-- `rent_due` is that contracted figure, computed per property from
-- properties.monthly_rent_owed. `rent_received` is kept for the manual-line
-- form, where an agency may still need to credit an ad-hoc receipt.
-- ============================================================

alter table public.owner_transactions
  drop constraint if exists owner_transactions_type_check;

alter table public.owner_transactions
  add constraint owner_transactions_type_check check (type in (
    'rent_received',
    'rent_due',
    'management_fee',
    'works_order',
    'other_deduction',
    'payment_to_owner',
    'opening_balance',
    'adjustment'
  ));

comment on column public.owner_transactions.type is
  'rent_due = contracted rent owed to the landlord (property-level, the statement default); rent_received = an ad-hoc receipt credited by hand.';
