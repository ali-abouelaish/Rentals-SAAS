-- Recurring job health.
--
-- Thirteen jobs run in-process via node-cron (src/lib/cron/scheduler.ts) and
-- report only to stdout. We self-host on a VPS behind PM2, so "it failed" is
-- discoverable solely by SSHing in and reading PM2's log buffer — and the
-- failure mode that matters most, a job that quietly stops firing at all,
-- produces no log line to find.
--
-- One row per run. The scheduler's existing `guarded()` wrapper already wraps
-- every job, so recording start and finish there instruments all of them at
-- once, with no change to any individual job.

create table if not exists public.platform_job_runs (
  id uuid primary key default gen_random_uuid(),

  -- Matches the name passed to guarded() in the scheduler, e.g.
  -- 'rent-reminders'. Not a foreign key: the job list is code.
  job_name text not null,

  started_at  timestamptz not null default now(),
  finished_at timestamptz,

  -- Stored rather than computed from the timestamps so a row whose finish was
  -- never written (process killed mid-run) stays distinguishable from one that
  -- genuinely took no time.
  duration_ms integer,

  -- running — started, not yet finished. A row stuck here is itself the signal:
  --           the process died mid-job.
  -- ok      — completed.
  -- failed  — threw.
  -- skipped — the previous run was still in flight. Today this is a console
  --           warning that vanishes; repeated skips mean a job is overrunning
  --           its own interval, which is worth seeing.
  status text not null default 'running'
    check (status in ('running', 'ok', 'failed', 'skipped')),

  trigger text not null default 'schedule'
    check (trigger in ('schedule', 'manual')),

  -- The job's own return value, whatever shape it is. Every job already returns
  -- a summary object that currently goes to console.log and no further.
  result jsonb,

  error text,

  created_at timestamptz not null default now()
);

-- "When did each job last run, and how did it go" — the main view's query.
create index if not exists idx_job_runs_name_started
  on public.platform_job_runs (job_name, started_at desc);

-- "What has failed recently" — the alert query.
create index if not exists idx_job_runs_status_started
  on public.platform_job_runs (status, started_at desc);

comment on table public.platform_job_runs is
  'One row per recurring-job execution: outcome, duration and result summary. Written by guarded() in src/lib/cron/scheduler.ts.';

comment on column public.platform_job_runs.status is
  'running rows that never reached a terminal status indicate the process died mid-job.';

-- ============================================================
-- Row Level Security
-- ============================================================
-- Enabled, no policies: operational data about the platform as a whole, read
-- only by super admins through the service-role client. Same reasoning as
-- platform_audit_log — see 20260913000002.
alter table public.platform_job_runs enable row level security;
