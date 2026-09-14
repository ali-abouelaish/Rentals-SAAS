// The recurring job catalogue: one entry per job, and the only place a schedule
// is written down.
//
// This used to live as cron expressions in scheduler.ts with prose comments
// beside them, and the two drifted — spareroom-scraper carried a comment saying
// 02:40 above an expression that fired at 09:00. Nothing could have caught that,
// because the comment and the code were independent. (The 09:00 slot itself was
// then kept on purpose: that is when the scrape has really been running, and
// sharing the tick with rent-reminders is accepted rather than accidental.)
// Here the description sits on the same object as the expression,
// and the health view reads its staleness threshold from the same row rather
// than keeping a second copy.
//
// Importing this pulls in every job module, so it is server-only by nature.
// The health view needs only the metadata, which is why `JOB_METADATA` is
// exported separately and carries no function references.

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
import { runPlatformInvoices } from "./platformInvoices";
import { runUsageRollup } from "./usageRollup";
import { runLandlordSheets } from "./landlordSheets";
import { runSpareroomScraper } from "./spareroomScraper";

/** How often a job is expected to run, for staleness detection. */
export type JobCadence = "frequent" | "daily" | "monthly";

export type JobMetadata = {
  name: string;
  /** Human label for the health table. */
  label: string;
  cron: string;
  cadence: JobCadence;
  /**
   * Hours after which a silent job is considered stale.
   *
   * Generous relative to the cadence: a daily job gets well over a day, so a
   * single late run or a clock-boundary edge does not raise a false alarm. What
   * this catches is a job that has stopped entirely.
   */
  staleAfterHours: number;
  /** Why it runs when it runs. Shown as the row's help text. */
  description: string;
};

export type CronJob = JobMetadata & {
  run: () => Promise<unknown>;
};

const TIMEZONE_NOTE = "Europe/London";

export const CRON_JOBS: CronJob[] = [
  {
    name: "rent-reminders",
    label: "Rent reminders",
    cron: "0 9 * * *",
    cadence: "daily",
    staleAfterHours: 30,
    description: `Daily rent-due and arrears emails at 09:00 ${TIMEZONE_NOTE}. The job re-checks each agency's own send window.`,
    run: runRentReminders,
  },
  {
    name: "mydeposits-poll",
    label: "mydeposits poll",
    cron: "*/15 * * * *",
    cadence: "frequent",
    staleAfterHours: 2,
    description:
      "Polls mydeposits every 15 minutes for protection status changes and certificates.",
    run: runMydepositsPoll,
  },
  {
    name: "tds-poll",
    label: "TDS poll",
    cron: "*/15 * * * *",
    cadence: "frequent",
    staleAfterHours: 2,
    description:
      "Polls TDS every 15 minutes for Deposit Account Numbers and DPC certificates.",
    run: runTdsPoll,
  },
  {
    name: "gmail-sync",
    label: "Gmail lead sync",
    cron: "*/15 * * * *",
    cadence: "frequent",
    staleAfterHours: 2,
    description: "Pulls portal lead emails from connected Gmail mailboxes every 15 minutes.",
    run: runGmailSync,
  },
  {
    name: "message-drain",
    label: "Message queue drain",
    cron: "*/5 * * * *",
    cadence: "frequent",
    staleAfterHours: 1,
    description:
      "Drains due scheduled_messages every 5 minutes. Frequent so ad-hoc reminders are not stuck behind a daily job.",
    run: runMessageDrain,
  },
  {
    name: "release-units",
    label: "Release moved-out units",
    cron: "5 0 * * *",
    cadence: "daily",
    staleAfterHours: 30,
    description: "Frees units whose tenants have moved out, just after midnight.",
    run: runReleaseMovedOutUnits,
  },
  {
    name: "spareroom-scraper",
    label: "SpareRoom scraper",
    cron: "0 9 * * *",
    cadence: "daily",
    staleAfterHours: 30,
    description: `Re-scrapes every agency's SpareRoom roster daily at 09:00 ${TIMEZONE_NOTE}. This is the time it has actually been running at, so it is kept here deliberately rather than moved overnight. It is long-running (it paces itself between advert pages) and shares the 09:00 slot with rent-reminders; both are started in the same tick, and the scraper then runs on well past it.`,
    run: runSpareroomScraper,
  },
  {
    name: "archive-todos",
    label: "Archive completed to-dos",
    cron: "0 3 * * *",
    cadence: "daily",
    staleAfterHours: 30,
    description: "Archives completed PM to-dos at 03:00.",
    run: runArchiveCompletedTodos,
  },
  {
    name: "landlord-sheets",
    label: "Landlord spreadsheets",
    cron: "20 7 * * *",
    cadence: "daily",
    staleAfterHours: 30,
    description:
      "Re-reads landlord listing spreadsheets at 07:20, before the morning jobs, so the day's listings are current. The job honours each landlord's own cadence, so an extra fire does not force early re-reads.",
    run: runLandlordSheets,
  },
  {
    name: "email-provider-health",
    label: "Mailbox health check",
    cron: "0 8 * * *",
    cadence: "daily",
    staleAfterHours: 30,
    description:
      "Checks each agency's mailbox connection at 08:00 — one hour before rent-reminders — so a dead connection is found and the agency alerted before the daily send depends on it.",
    run: runEmailProviderHealth,
  },
  {
    name: "automation-sweep",
    label: "Automation sweep",
    cron: "30 8 * * *",
    cadence: "daily",
    staleAfterHours: 30,
    description:
      "Evaluates automation rules at 08:30 and enqueues the day's messages, before the default 09:00 send hour. Idempotent — automation_runs dedupes.",
    run: () => runAutomationSweep(),
  },
  {
    name: "usage-rollup",
    label: "Usage rollup",
    cron: "0 5 1 * *",
    cadence: "monthly",
    // A month plus a couple of days: it only ever runs on the 1st, so it is
    // legitimately silent for four weeks at a time.
    staleAfterHours: 24 * 33,
    description:
      "Counts last month's metered usage at 05:00 on the 1st. Must finish before platform-invoices at 06:30, which reads those counters to build overage lines.",
    run: () => runUsageRollup(),
  },
  {
    name: "owner-statements",
    label: "Owner statements",
    cron: "0 6 1 * *",
    cadence: "monthly",
    staleAfterHours: 24 * 33,
    description:
      "Drafts monthly landlord statements at 06:00 on the 1st for the month that just ended. Drafts only — sending is a manual review step on the landlord's Statements tab.",
    run: runOwnerStatements,
  },
  {
    name: "platform-invoices",
    label: "Platform invoices",
    cron: "30 6 1 * *",
    cadence: "monthly",
    staleAfterHours: 24 * 33,
    description:
      "Builds draft platform invoices at 06:30 on the 1st for the month now STARTING — platform charges bill in advance, unlike owner statements which report the month just ended. Drafts only; issuing is deliberate, and an issued invoice is never rewritten.",
    run: runPlatformInvoices,
  },
];

/**
 * Metadata only, for the health view.
 *
 * Separate from CRON_JOBS so a page can list expected jobs and their schedules
 * without importing every job module and its database clients.
 */
export const JOB_METADATA: JobMetadata[] = CRON_JOBS.map(({ run: _run, ...meta }) => meta);

export function getJobMetadata(name: string): JobMetadata | null {
  return JOB_METADATA.find((job) => job.name === name) ?? null;
}
