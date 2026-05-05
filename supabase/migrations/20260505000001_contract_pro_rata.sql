-- Pro-rata first month support for property contracts.
-- When set, the tenant pays `pro_rata_amount` for the partial first period
-- (start_date through the last day of the move-in month) plus the next full
-- calendar month in advance. Regular monthly cycle resumes from the month after.
-- NULL preserves the existing behaviour (rent_pcm applies from start_date).

alter table property_contracts
  add column pro_rata_amount numeric(10,2) null;

comment on column property_contracts.pro_rata_amount is
  'Pro-rated rent for the partial first period (start_date through end of move-in month). NULL = no pro-rata, rent_pcm applies from start_date.';
