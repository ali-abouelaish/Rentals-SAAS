// Recording recurring-job outcomes to platform_job_runs.
//
// Every write here is best-effort and swallows its own errors. A cron process
// that dies because it could not write a log row is strictly worse than one
// whose logging has a gap — the job itself is the thing that matters, and the
// database it is failing to reach is very often the database the job needs
// anyway, so the run is about to report a real failure of its own.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type JobTrigger = "schedule" | "manual";

/** Open a run row. Returns null if it could not be written. */
async function startJobRun(jobName: string, trigger: JobTrigger): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("platform_job_runs")
      .insert({ job_name: jobName, trigger, status: "running" })
      .select("id")
      .single();

    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

async function finishJobRun(
  runId: string,
  startedAt: number,
  status: "ok" | "failed",
  result: unknown,
  error?: string
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin
      .from("platform_job_runs")
      .update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        status,
        // Jobs return plain summary objects. Guard anyway: a job returning
        // something non-serialisable must not turn a successful run into a
        // failed log write.
        result: serialisable(result),
        error: error ?? null,
      })
      .eq("id", runId);
  } catch {
    // Already reported by the caller's own logging.
  }
}

function serialisable(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

/**
 * Record that a run was skipped because the previous one was still in flight.
 *
 * Worth a row rather than only a warning: a job repeatedly skipping is one that
 * has started overrunning its own interval, which is invisible if the only
 * trace is a line in a log buffer nobody reads.
 */
export async function recordSkippedJobRun(jobName: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    await admin.from("platform_job_runs").insert({
      job_name: jobName,
      trigger: "schedule",
      status: "skipped",
      finished_at: now,
      duration_ms: 0,
      error: "Previous run still in flight",
    });
  } catch {
    // Best effort.
  }
}

/**
 * Run a job, recording its outcome.
 *
 * Rethrows whatever the job threw, after recording it — callers decide how to
 * react (the scheduler logs and continues; the HTTP trigger returns a 500).
 */
export async function withJobRun<T>(
  jobName: string,
  trigger: JobTrigger,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  const runId = await startJobRun(jobName, trigger);

  try {
    const result = await fn();
    if (runId) await finishJobRun(runId, startedAt, "ok", result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) await finishJobRun(runId, startedAt, "failed", null, message);
    throw err;
  }
}
