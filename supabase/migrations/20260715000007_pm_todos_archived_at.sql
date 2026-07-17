-- ============================================================
-- Soft-archive marker for pm_todos.
-- ============================================================
-- Completed tasks are cleared off the dashboard list — either by
-- the daily cron job or the manual "Clear done" button — by
-- stamping archived_at rather than deleting the row. The retained
-- rows are the audit trail of everything that was completed, shown
-- read-only in the dashboard's "Completed history" section.
-- ============================================================

alter table public.pm_todos add column archived_at timestamptz;

-- The active dashboard list excludes archived rows; a partial index
-- keeps that lookup tight as the archive grows over time.
drop index if exists pm_todos_tenant_id_is_done_due_date_idx;
create index on public.pm_todos (tenant_id, is_done, due_date) where archived_at is null;

-- Completed-task history (audit) lookups.
create index on public.pm_todos (tenant_id, archived_at);
