-- Add check constraint for rental_codes.status to document valid values
-- (column is text; this enforces valid statuses at the DB level)
alter table rental_codes
  drop constraint if exists rental_codes_status_check;

alter table rental_codes
  add constraint rental_codes_status_check
  check (status in ('pending', 'approved', 'paid', 'refunded', 'need_more_info'));
