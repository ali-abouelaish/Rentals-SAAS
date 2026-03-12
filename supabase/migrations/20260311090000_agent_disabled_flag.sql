-- Add a soft-disable flag for agents so they can be hidden
-- from selection and listings without deleting historical data.

alter table agent_profiles
  add column if not exists is_disabled boolean not null default false;

