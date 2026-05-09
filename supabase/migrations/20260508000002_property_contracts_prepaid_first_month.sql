-- Independent flag for "tenant paid the first full calendar month in advance".
-- Until now this was implicitly bundled into pro_rata_amount (the ProRataField
-- copy said "+ collect next month in advance"). Splitting them lets the agent
-- record either pattern:
--   * pro-rata only — tenant only paid for the partial move-in month
--   * pro-rata + advance — tenant paid partial month + first full month upfront
--   * advance only — full first month paid upfront, no partial period
--
-- The flag is purely about *what was collected at move-in*. expectedRent()
-- still derives the running expected total; this flag drives auto-insertion
-- of the corresponding rent_payments rows when the contract is created.

alter table property_contracts
  add column prepaid_first_full_month boolean not null default false;

comment on column property_contracts.prepaid_first_full_month is
  'True when the tenant paid the first full calendar month after the move-in month upfront at signing. Independent of pro_rata_amount.';
