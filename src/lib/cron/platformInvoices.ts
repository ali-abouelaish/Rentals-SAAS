// Monthly platform-invoice generation. Runs on the 1st (Europe/London) and
// builds a DRAFT invoice per agency for the month now starting.
//
// The month NOW STARTING, not the one that just ended — unlike owner
// statements. Platform charges bill in advance: an integration activated in
// September gets `billing_starts_on = 1 October`, and an envelope purchase made
// in September is stamped with the October billing period, because that is what
// the agency was told in the purchase dialog. So on 1 October the run gathers
// everything dated 1 October.
//
// Generates drafts only. Nothing is emailed, nothing is charged, and an
// invoice already issued or paid is never touched — see canRegenerate.

import { generatePlatformInvoices } from "@/lib/billing/generate";
import { currentBillingPeriod } from "@/lib/billing/rates";

export type PlatformInvoicesSummary = {
  ok: true;
  skipped?: boolean;
  reason?: string;
  created?: number;
  updated?: number;
  skippedEmpty?: number;
  skippedLocked?: number;
  totalPence?: number;
  failed?: number;
  period?: { year: number; month: number };
  durationMs: number;
};

/** True when the current day-of-month in Europe/London is the 1st. */
function isLondonFirstOfMonth(now: Date): boolean {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
  }).format(now);
  return parseInt(day, 10) === 1;
}

export async function runPlatformInvoices(): Promise<PlatformInvoicesSummary> {
  const startedAt = Date.now();
  const now = new Date();

  // The cron expression already restricts this to the 1st. Checked again here
  // because the expression runs on server time while the business month is
  // London's, and because this is callable by hand — generating a month early
  // would raise invoices nobody owes yet.
  if (!isLondonFirstOfMonth(now)) {
    return {
      ok: true,
      skipped: true,
      reason: "not the 1st in Europe/London",
      durationMs: Date.now() - startedAt,
    };
  }

  const period = currentBillingPeriod(now);
  const result = await generatePlatformInvoices(period);

  return {
    ok: true,
    created: result.created,
    updated: result.updated,
    skippedEmpty: result.skippedEmpty,
    skippedLocked: result.skippedLocked,
    totalPence: result.totalPence,
    failed: result.errors.length,
    period: { year: period.year, month: period.month },
    durationMs: Date.now() - startedAt,
  };
}
