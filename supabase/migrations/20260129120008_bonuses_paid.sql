alter table bonuses
  add column if not exists paid_at timestamptz;

alter table bonuses
  add column if not exists paid_by_user_id uuid references user_profiles(id);
