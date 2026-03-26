-- Add public contact info fields to agent_profiles for digital business card
alter table public.agent_profiles
  add column if not exists contact_email text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists linkedin_url text;
