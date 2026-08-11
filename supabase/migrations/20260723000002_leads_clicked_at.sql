-- Track when a lead was first opened/clicked, so the list can distinguish
-- unread from read leads. Nullable: null = never opened.
alter table public.leads
  add column if not exists clicked_at timestamptz;
