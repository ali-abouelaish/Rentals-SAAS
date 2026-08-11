-- Generalised scheduled-messages queue + per-tenant message templates.
-- One queue, two producers: ad-hoc reminders (null rule_id) and automation
-- rules (rule_id FK added by the automation_rules migration). Queue mechanics
-- copied from email_outbox (20260313000000): claim via FOR UPDATE SKIP LOCKED,
-- retry with backoff, dead at 5 attempts. Rows with channel 'in_app' double as
-- the persistent in-app notification store — 'sent' means visible in the
-- reminders inbox until acknowledged/dismissed.

-- ---------------------------------------------------------------------------
-- message_templates: per-tenant editable copies, lazily seeded from code
-- defaults (never shared globally).
-- ---------------------------------------------------------------------------
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  name text not null,
  channel text not null check (channel in ('email', 'sms', 'in_app')),
  entity_type text not null check (entity_type in
    ('property', 'unit', 'tenancy', 'pm_tenant', 'works_order', 'owner', 'none')),
  subject text,
  body text not null,
  is_default boolean not null default false,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key, channel)
);

alter table public.message_templates enable row level security;

create policy "message_templates select" on public.message_templates
  for select using (tenant_id = (select current_tenant_id()));

create policy "message_templates insert" on public.message_templates
  for insert with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

create policy "message_templates update" on public.message_templates
  for update using (tenant_id = (select current_tenant_id()) and (select is_admin()))
  with check (tenant_id = (select current_tenant_id()) and (select is_admin()));

create policy "message_templates delete" on public.message_templates
  for delete using (tenant_id = (select current_tenant_id()) and (select is_admin()));

create trigger message_templates_touch_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- scheduled_messages: THE queue. Subject/body are rendered at enqueue time
-- (snapshot semantics); merge_context is kept for audit and explicit
-- re-rendering. Recipient address is resolved at dispatch time.
-- ---------------------------------------------------------------------------
create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_id uuid,
  template_id uuid references public.message_templates(id) on delete set null,
  channel text not null check (channel in ('email', 'sms', 'in_app')),
  recipient_kind text not null check (recipient_kind in ('resolver', 'literal', 'staff')),
  recipient_resolver text check (recipient_resolver in
    ('tenancy_renter', 'property_owner', 'works_order_contractor')),
  recipient_value text,
  assignee_user_id uuid references public.user_profiles(id) on delete set null,
  subject text,
  body text not null,
  merge_context jsonb not null default '{}'::jsonb,
  related_entity_type text check (related_entity_type in
    ('property', 'unit', 'tenancy', 'pm_tenant', 'works_order', 'owner')),
  related_entity_id uuid,
  send_at timestamptz not null,
  status text not null default 'queued' check (status in
    ('queued', 'sending', 'sent', 'failed', 'cancelled', 'snoozed', 'dismissed')),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  sent_to text,
  acknowledged_at timestamptz,
  recurrence jsonb,
  series_id uuid,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipient_kind <> 'literal' or recipient_value is not null),
  check (recipient_kind <> 'resolver'
         or (recipient_resolver is not null and related_entity_id is not null)),
  check (recipient_kind <> 'staff' or assignee_user_id is not null)
);

create index scheduled_messages_due_idx on public.scheduled_messages (send_at)
  where status in ('queued', 'snoozed');
create index scheduled_messages_tenant_idx
  on public.scheduled_messages (tenant_id, status, send_at desc);
create index scheduled_messages_entity_idx
  on public.scheduled_messages (tenant_id, related_entity_type, related_entity_id);
create index scheduled_messages_series_idx
  on public.scheduled_messages (series_id) where series_id is not null;
-- Daily rate-limit accounting: count of non-in_app sends per tenant per day.
create index scheduled_messages_sent_idx
  on public.scheduled_messages (tenant_id, sent_at) where status = 'sent';

alter table public.scheduled_messages enable row level security;

-- Reads for tenant members (inbox, activity views); all writes go through the
-- service-role admin client (same posture as rent_reminder_log/email_outbox).
create policy "scheduled_messages select" on public.scheduled_messages
  for select using (tenant_id = (select current_tenant_id()));

create trigger scheduled_messages_touch_updated_at
  before update on public.scheduled_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Claim/fail RPCs — adapted from claim_email_outbox_batch /
-- mark_email_outbox_failed. 'snoozed' rows are claimable exactly like
-- 'queued' (snoozing just pushes send_at forward).
-- ---------------------------------------------------------------------------
create or replace function claim_scheduled_messages_batch(lim int)
returns setof public.scheduled_messages
language sql
security definer
as $$
  with to_claim as (
    select id from public.scheduled_messages
    where status in ('queued', 'snoozed')
      and send_at <= now()
      and attempts < 5
    order by send_at asc
    limit lim
    for update skip locked
  ),
  updated as (
    update public.scheduled_messages m
    set status = 'sending', updated_at = now()
    from to_claim t
    where m.id = t.id
    returning m.*
  )
  select * from updated;
$$;

create or replace function mark_scheduled_message_failed(p_id uuid, p_error text)
returns void
language plpgsql
security definer
as $$
declare
  cur_attempts int;
  next_attempts int;
  is_final boolean;
  backoff_minutes int[] := array[1, 5, 15, 60, 360];
  send_at_new timestamptz;
  idx int;
begin
  select attempts into cur_attempts from public.scheduled_messages where id = p_id;
  if not found then
    return;
  end if;
  next_attempts := cur_attempts + 1;
  is_final := next_attempts >= 5;
  idx := least(cur_attempts, 4) + 1;
  send_at_new := now() + (backoff_minutes[idx] * interval '1 minute');

  update public.scheduled_messages
  set
    attempts = next_attempts,
    last_error = p_error,
    status = case when is_final then 'failed' else 'queued' end,
    send_at = case when is_final then send_at else send_at_new end,
    updated_at = now()
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-agency send window (do not text a tenant at 6am) + daily blast-radius
-- guard. Hours are Europe/London wall-clock; messages send when
-- window_start <= hour < window_end.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists msg_send_window_start smallint not null default 8
    check (msg_send_window_start between 0 and 23),
  add column if not exists msg_send_window_end smallint not null default 20
    check (msg_send_window_end between 1 and 24),
  add column if not exists msg_daily_limit int not null default 200
    check (msg_daily_limit > 0);
