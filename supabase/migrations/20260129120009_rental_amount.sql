alter table rental_codes
  add column if not exists rental_amount_gbp numeric(12,2) not null default 0;

update rental_codes
set rental_amount_gbp = consultation_fee_amount
where rental_amount_gbp = 0 and consultation_fee_amount is not null;
