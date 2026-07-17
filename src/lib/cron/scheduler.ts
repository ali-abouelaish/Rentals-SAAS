// In-process cron scheduler. Replaces Vercel Cron (we self-host on a VPS behind
// PM2, so there is no external scheduler). Started once per Node process from
// src/instrumentation.ts. The same jobs are still reachable over HTTP at
// /api/cron/* (CRON_SECRET-guarded) for manual/backup triggering.
//
// Cadence mirrors the old vercel.json:
//   rent-reminders   09:00 Europe/London daily  (job re-checks the window)
//   mydeposits-poll  every 15 minutes
//   tds-poll         every 15 minutes
//
// Single-instance assumption: PM2 fork mode runs one process, so these fire
// once. If you switch PM2 to cluster mode (`-i > 1`), set CRON_DISABLED=1 on all
// but one instance, or the jobs will fire per instance. Opt out entirely with
// CRON_DISABLED=1.

import cron from "node-cron";
import { runRentReminders } from "./rentReminders";
import { runMydepositsPoll } from "./mydepositsPoll";
import { runTdsPoll } from "./tdsPoll";
import { runArchiveCompletedTodos } from "./archiveTodos";

const TIMEZONE = "Europe/London";

// Guard against double-scheduling if register() is somehow called twice.
let started = false;

/** Run a job unless a previous run is still in flight; log the outcome. */
function guarded(name: string, fn: () => Promise<unknown>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) {
      console.warn(`[cron] ${name}: previous run still in flight, skipping`);
      return;
    }
    running = true;
    try {
      const result = await fn();
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

  cron.schedule("0 9 * * *", guarded("rent-reminders", runRentReminders), opts);
  cron.schedule("*/15 * * * *", guarded("mydeposits-poll", runMydepositsPoll), opts);
  cron.schedule("*/15 * * * *", guarded("tds-poll", runTdsPoll), opts);
  cron.schedule("0 3 * * *", guarded("archive-todos", runArchiveCompletedTodos), opts);

  console.log(`[cron] scheduler started (timezone ${TIMEZONE}): rent-reminders, mydeposits-poll, tds-poll, archive-todos`);
}
