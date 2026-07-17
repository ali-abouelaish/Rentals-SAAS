// Daily to-do housekeeping. Clears completed dashboard tasks off the active list
// by stamping archived_at, so the board starts each day fresh. Archived rows are
// retained as the completed-task audit trail (surfaced read-only in the "Completed
// history" section of the PM dashboard). Driven by the in-process scheduler
// (src/lib/cron/scheduler.ts) with an HTTP backup at /api/cron/archive-todos.
//
// Runs across all tenants via the admin client (no per-user auth context), so it
// deliberately bypasses RLS — it only ever touches already-completed tasks.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ArchiveTodosSummary = {
  ok: true;
  archived: number;
  durationMs: number;
};

export async function runArchiveCompletedTodos(): Promise<ArchiveTodosSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("pm_todos")
    .update({ archived_at: new Date().toISOString() })
    .eq("is_done", true)
    .is("archived_at", null)
    .select("id");
  if (error) throw new Error(error.message);

  return { ok: true, archived: data?.length ?? 0, durationMs: Date.now() - startedAt };
}
