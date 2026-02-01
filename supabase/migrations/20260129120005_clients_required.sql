alter table clients
  add column if not exists university_name text;

update clients
set
  dob = coalesce(dob, ''),
  email = coalesce(email, ''),
  nationality = coalesce(nationality, ''),
  current_address = coalesce(current_address, ''),
  company_name = coalesce(company_name, ''),
  university_name = coalesce(university_name, ''),
  company_address = coalesce(company_address, ''),
  occupation = coalesce(occupation, '');

alter table clients
  alter column dob set default '',
  alter column dob set not null,
  alter column email set default '',
  alter column email set not null,
  alter column nationality set default '',
  alter column nationality set not null,
  alter column current_address set default '',
  alter column current_address set not null,
  alter column company_name set default '',
  alter column company_name set not null,
  alter column university_name set default '',
  alter column university_name set not null,
  alter column company_address set default '',
  alter column company_address set not null,
  alter column occupation set default '',
  alter column occupation set not null;
