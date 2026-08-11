// In-process cron scheduler. Replaces Vercel Cron (we self-host on a VPS behind
// PM2, so there is no external scheduler). Started once per Node process from
// src/instrumentation.ts. The same jobs are still reachable over HTTP at
// /api/cron/* (CRON_SECRET-guarded) for manual/backup triggering.
//
// Cadence mirrors the old vercel.json:
//   rent-reminders   09:00 Europe/London daily  (job re-checks the window)
//   mydeposits-poll  every 15 minutes
//   tds-poll         every 15 minutes
//   gmail-sync       every 15 minutes
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
import { runReleaseMovedOutUnits } from "./releaseMovedOutUnits";
import { runEmailProviderHealth } from "./emailProviderHealth";
import { runGmailSync } from "./gmailSync";
import { runMessageDrain } from "./messageDrain";
import { runAutomationSweep } from "./automationSweep";
import { runOwnerStatements } from "./ownerStatements";
import { runLandlordSheets } from "./landlordSheets";

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
  cron.schedule("*/15 * * * *", guarded("gmail-sync", runGmailSync), opts);
  cron.schedule("0 3 * * *", guarded("archive-todos", runArchiveCompletedTodos), opts);
  cron.schedule("5 0 * * *", guarded("release-units", runReleaseMovedOutUnits), opts);
  // 08:00 — one hour before rent-reminders — so a dead mailbox connection is
  // detected and the agency alerted before the daily send depends on it.
  cron.schedule("0 8 * * *", guarded("email-provider-health", runEmailProviderHealth), opts);
  // Drains due scheduled_messages (reminders + automation sends). Frequent so
  // ad-hoc reminders aren't stuck waiting for a daily job.
  cron.schedule("*/5 * * * *", guarded("message-drain", runMessageDrain), opts);
  // 08:30 — evaluates automation rules and enqueues today's messages, before
  // the default 09:00 send hour. Idempotent (automation_runs dedupes).
  cron.schedule("30 8 * * *", guarded("automation-sweep", () => runAutomationSweep()), opts);
  // 06:00 on the 1st — generate DRAFT owner statements for the month that just
  // ended (job re-checks it's the 1st in Europe/London). Drafts only; sending
  // is a manual review step on the landlord's Statements tab (/owners/[id]).
  cron.schedule("0 6 1 * *", guarded("owner-statements", runOwnerStatements), opts);
  // 07:20 — re-reads landlord listing spreadsheets, before the 08:00/09:00 jobs
  // so the day's listings are current. The job re-checks each landlord's own
  // daily cadence, so an extra fire does not force early re-reads.
  cron.schedule("20 7 * * *", guarded("landlord-sheets", runLandlordSheets), opts);

  console.log(`[cron] scheduler started (timezone ${TIMEZONE}): rent-reminders, mydeposits-poll, tds-poll, gmail-sync, archive-todos, release-units, email-provider-health, message-drain, automation-sweep, owner-statements, landlord-sheets`);
}
