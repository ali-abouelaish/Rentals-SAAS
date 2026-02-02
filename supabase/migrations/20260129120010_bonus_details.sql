alter table bonuses
  add column if not exists bonus_date date not null default current_date;

alter table bonuses
  add column if not exists client_name text not null default '';

alter table bonuses
  add column if not exists property_address text not null default '';

alter table bonuses
  add column if not exists notes text;
