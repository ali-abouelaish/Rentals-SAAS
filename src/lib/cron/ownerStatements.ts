// Monthly owner-statement generation. Runs on the 1st of the month
// (Europe/London), generating a DRAFT statement + PDF for the month that just
// ended, for every owner with at least one property (tenants with the feature
// switched off are excluded — see listOwnersToGenerate). Generates drafts only
// — nothing is emailed; the agency reviews and sends from the landlord's
// Statements tab at /owners/[id].
//
// Idempotent: the owner_statements unique key (tenant, owner, period) means a
// re-run refreshes existing drafts and never duplicates; a statement already
// sent/void is left untouched. PDF rendering is CPU-heavy, so owners are
// processed sequentially rather than all at once.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateStatementForOwner,
  listOwnersToGenerate,
} from "@/features/owner-statements/lib/generate";

export type OwnerStatementsSummary = {
  ok: true;
  skipped?: boolean;
  reason?: string;
  processed: number;
  generated: number;
  skippedLocked: number;
  failed: number;
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

/** The calendar month that just ended, relative to `now` in Europe/London. */
function previousMonth(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** Run monthly owner-statement generation. `now` is injectable for tests. */
export async function runOwnerStatements(now: Date = new Date()): Promise<OwnerStatementsSummary> {
  const startedAt = Date.now();

  if (!isLondonFirstOfMonth(now)) {
    return {
      ok: true,
      skipped: true,
      reason: "Only runs on the 1st of the month (Europe/London)",
      processed: 0,
      generated: 0,
      skippedLocked: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const { year, month } = previousMonth(now);
  const admin = createSupabaseAdminClient();
  const owners = await listOwnersToGenerate(admin);

  let generated = 0;
  let skippedLocked = 0;
  let failed = 0;

  for (const o of owners) {
    try {
      const result = await generateStatementForOwner(admin, {
        tenantId: o.tenant_id,
        ownerId: o.owner_id,
        year,
        month,
      });
      if (result.status === "generated") generated++;
      else skippedLocked++;
    } catch (err) {
      failed++;
      console.error("[cron] owner-statement generation failed", {
        tenantId: o.tenant_id,
        ownerId: o.owner_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: true,
    processed: owners.length,
    generated,
    skippedLocked,
    failed,
    period: { year, month },
    durationMs: Date.now() - startedAt,
  };
}
