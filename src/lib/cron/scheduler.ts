// In-process cron scheduler. Replaces Vercel Cron (we self-host on a VPS behind
// PM2, so there is no external scheduler). Started once per Node process from
// src/instrumentation.ts. The same jobs are still reachable over HTTP at
// /api/cron/* (CRON_SECRET-guarded) for manual/backup triggering.
//
// WHAT runs and WHEN lives in ./jobCatalogue.ts, not here. This file is only the
// registration mechanism. The schedules used to sit inline with prose comments
// beside them and the two drifted — one job's comment said 02:40 above an
// expression that fired at 09:00, on top of another job. The catalogue puts the
// expression and its explanation on the same object, and the admin health view
// reads its staleness thresholds from there too rather than keeping a copy.
//
// Single-instance assumption: PM2 fork mode runs one process, so these fire
// once. If you switch PM2 to cluster mode (`-i > 1`), set CRON_DISABLED=1 on all
// but one instance, or the jobs will fire per instance. Opt out entirely with
// CRON_DISABLED=1.

import cron from "node-cron";
import { CRON_JOBS } from "./jobCatalogue";
import { recordSkippedJobRun, withJobRun } from "./jobRuns";

const TIMEZONE = "Europe/London";

// Guard against double-scheduling if register() is somehow called twice.
let started = false;

/**
 * Run a job unless a previous run is still in flight; log the outcome.
 *
 * Every job goes through here, which is why the platform_job_runs recording
 * lives at this single point rather than in thirteen job files. See
 * ./jobRuns.ts — those writes are best-effort and never throw, so instrumenting
 * cannot be the thing that breaks a job.
 */
function guarded(name: string, fn: () => Promise<unknown>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) {
      console.warn(`[cron] ${name}: previous run still in flight, skipping`);
      await recordSkippedJobRun(name);
      return;
    }
    running = true;
    try {
      const result = await withJobRun(name, "schedule", fn);
      console.log(`[cron] ${name} ok`, result);
    } catch (err) {
      console.error(`[cron] ${name} failed`, err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };
}

/**
 * Register the recurring jobs. Idempotent and a no-op when CRON_DISABLED=1 or
 * outside the Node.js runtime. Safe to call from instrumentation's register().
 */
export function startCronScheduler(): void {
  if (started) return;
  if (process.env.CRON_DISABLED === "1") {
    console.log("[cron] scheduler disabled via CRON_DISABLED=1");
    return;
  }
  started = true;

  const opts = { timezone: TIMEZONE } as const;

  for (const job of CRON_JOBS) {
    cron.schedule(job.cron, guarded(job.name, job.run), opts);
  }

  // Lists every job it actually registered, derived from the catalogue — the old
  // hand-written list had fallen two jobs behind what was running.
  console.log(
    `[cron] scheduler started (timezone ${TIMEZONE}), ${CRON_JOBS.length} jobs: ${CRON_JOBS.map(
      (job) => `${job.name} (${job.cron})`
    ).join(", ")}`
  );
}
