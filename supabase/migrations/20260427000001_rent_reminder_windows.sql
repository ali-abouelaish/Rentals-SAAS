-- Rent reminder windows: roll out only at "3 days before due" and "due today".
-- Overdue windows are dropped from the cron path; the CHECK constraint keeps
-- the old values so any historic rent_reminder_log rows remain valid.

alter table public.rent_reminder_log
  drop constraint if exists rent_reminder_log_reminder_type_check;

alter table public.rent_reminder_log
  add constraint rent_reminder_log_reminder_type_check
  check (reminder_type in (
    'upcoming_3d',
    'upcoming_5d',
    'due_today',
    'overdue_3d',
    'overdue_7d',
    'overdue_14d'
  ));
