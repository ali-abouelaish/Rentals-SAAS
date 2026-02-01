alter table clients
  add column if not exists company_or_university_name text;

update clients
set company_or_university_name = coalesce(company_name, university_name, '')
where company_or_university_name is null;

alter table clients
  alter column company_or_university_name set default '',
  alter column company_or_university_name set not null;
