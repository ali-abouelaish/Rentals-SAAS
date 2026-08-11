-- Automation rules + run log. Rules are per-tenant config rows evaluated by a
-- daily in-process sweep (date_offset / threshold triggers) and by app-level
-- event hooks (event triggers). The ONLY output of evaluation is rows in
-- scheduled_messages; automation_runs is the claim/audit table whose partial
-- unique index makes double-firing impossible (claimed BEFORE enqueue, same
-- discipline as rent_reminder_log in the legacy rent-reminder cron).

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  preset_key text,
  trigger_type text not null check (trigger_type in ('date_offset', 'event', 'threshold')),
  trigger_config jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  repeat_config jsonb,
  channel text not null check (channel in ('email', 'sms', 'in_app')),
  template_id uuid not null references public.message_templates(id) on delete restrict,
  recipient_config jsonb not null,
  send_hour smallint not null default 9 check (send_hour between 0 and 23),
  active boolean not null default false,
  dry_run boolean not null default false,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_rules_tenant_idx on public.automation_rules (tenant_id);
create index automation_rules_active_idx on public.automation_rules (active, dry_run);

alter table public.automation_rules enable row level security;

create policy "automation_rules select" on public.automation_rules
  for select using (tenant_id = (select current_tenant_id()));

create policy "automation_rules insert" on public.automation_rules
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

create policy "automation_rules update" on public.automation_rules
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

create policy "automation_rules delete" on public.automation_rules
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));

create trigger automation_rules_touch_updated_at
  before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- automation_runs: one row per (rule, entity, occasion) — live rows claim the
-- occasion, dry-run rows record what WOULD have fired.
--
-- dedupe_key semantics:
--   once-per-anchor rules  -> the anchor date ISO ("2026-09-01"); a corrected
--                             anchor (e.g. changed expiry date) is a new key
--                             and legitimately fires again
--   repeating rules        -> "<anchorISO>:r<runDateISO>"; the sweep only
--                             fires when the newest prior run for the anchor
--                             is >= every_days old and the condition holds
--   event rules            -> "<event>:<entityId>:<occurrence timestamp>"
-- ---------------------------------------------------------------------------
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  anchor_date date,
  dedupe_key text not null,
  run_date date not null default current_date,
  dry_run boolean not null default false,
  scheduled_message_id uuid references public.scheduled_messages(id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- THE double-fire guard for live runs. Partial, so dry-run cycles never block
-- the later live run.
create unique index automation_runs_no_double_fire
  on public.automation_runs (rule_id, entity_id, dedupe_key)
  where dry_run = false;

-- Dry runs dedupe per day instead, so a daily dry-run cycle logs each
-- would-send once per day rather than piling up duplicates.
create unique index automation_runs_dry_run_daily
  on public.automation_runs (rule_id, entity_id, dedupe_key, run_date)
  where dry_run = true;

create index automation_runs_rule_idx on public.automation_runs (rule_id, created_at desc);
create index automation_runs_repeat_idx
  on public.automation_runs (rule_id, entity_id, created_at desc)
  where dry_run = false;

alter table public.automation_runs enable row level security;

-- Select-only for tenant members (activity log, dry-run panel); writes go
-- through the service-role admin client in the sweep.
create policy "automation_runs select" on public.automation_runs
  for select using (tenant_id = (select current_tenant_id()));

-- Link the queue back to rules now that the rules table exists.
alter table public.scheduled_messages
  add constraint scheduled_messages_rule_fk
  foreign key (rule_id) references public.automation_rules(id) on delete set null;

create index scheduled_messages_rule_idx
  on public.scheduled_messages (rule_id) where rule_id is not null;
