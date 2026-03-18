-- landlord_id was never used; always inserted as null.
alter table rental_codes drop column if exists landlord_id;
