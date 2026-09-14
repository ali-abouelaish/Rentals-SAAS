// Monthly usage rollup. Runs 05:00 on the 1st (Europe/London), ahead of
// platform-invoices at 06:30, and counts the month that just CLOSED.
//
// The closed month, not the one now starting — the opposite of platform
// invoices, and deliberately so. Subscriptions bill in advance because the
// agency is buying access it is about to have; usage bills in arrears because
// it cannot be known until it has happened. So the invoice raised on 1 October
// carries October's subscriptions and September's usage, which is how every
// metered bill an agency has ever received is laid out.
//
// Counts rows in the tables that already record each event rather than reading
// a live counter. See 20260913000004_usage_metering.sql for why.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  METERS,
  priceUsage,
  type Meter,
  type MeterKey,
} from "@/lib/billing/meters";
import {
  billingPeriod,
  currentBillingPeriod,
  previousBillingPeriod,
  type BillingPeriod,
} from "@/lib/billing/rates";

export type UsageRollupSummary = {
  ok: true;
  skipped?: boolean;
  reason?: string;
  period?: { year: number; month: number };
  tenantsCounted?: number;
  countersWritten?: number;
  /** Tenants whose period is already locked by an issued or paid invoice. */
  skippedLocked?: number;
  totalBillablePence?: number;
  failed?: number;
  errors?: { tenantId: string; error: string }[];
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

/**
 * Exclusive upper bound for the period: midnight on the 1st of the next month.
 *
 * Using `< nextStart` rather than `<= period.end` avoids the classic off-by-one
 * where everything logged after 00:00:00 on the final day is silently dropped,
 * because `period.end` is a DATE and compares as that day's midnight.
 */
function periodBounds(period: BillingPeriod): { fromIso: string; toIso: string } {
  const next =
    period.month === 12
      ? billingPeriod(period.year + 1, 1)
      : billingPeriod(period.year, period.month + 1);

  return {
    fromIso: new Date(`${period.start}T00:00:00.000Z`).toISOString(),
    toIso: new Date(`${next.start}T00:00:00.000Z`).toISOString(),
  };
}

type CountRow = { tenant_id: string };

/**
 * Count one meter for every tenant at once.
 *
 * One query per meter across all agencies, not one per agency per meter — with
 * a few dozen tenants the latter is hundreds of round trips for numbers that
 * come out of a single scan.
 */
async function countMeter(
  meter: Meter,
  period: BillingPeriod
): Promise<Map<string, number>> {
  const admin = createSupabaseAdminClient();
  const { fromIso, toIso } = periodBounds(period);
  const counts = new Map<string, number>();

  const tally = (rows: CountRow[] | null) => {
    for (const row of rows ?? []) {
      if (!row.tenant_id) continue;
      counts.set(row.tenant_id, (counts.get(row.tenant_id) ?? 0) + 1);
    }
  };

  switch (meter.key) {
    case "emails_sent": {
      // Delivered only. Charging for a send that failed would be charging for
      // nothing, and the agency can see the failure in its own email log.
      const { data } = await admin
        .from("email_log")
        .select("tenant_id")
        .eq("status", "sent")
        .gte("sent_at", fromIso)
        .lt("sent_at", toIso);
      tally(data as CountRow[] | null);
      break;
    }

    case "ai_messages": {
      // Assistant replies only. The user's own messages are not a cost.
      const { data } = await admin
        .from("assistant_messages")
        .select("tenant_id")
        .eq("role", "assistant")
        .gte("created_at", fromIso)
        .lt("created_at", toIso);
      tally(data as CountRow[] | null);
      break;
    }

    case "deposits_registered": {
      // All three schemes share 'draft' as the pre-submission state, so
      // `status <> 'draft'` means "actually sent to the scheme" everywhere.
      // A draft the agency abandoned cost us no API call and is not billable.
      for (const table of ["mydeposits_protections", "tds_deposits", "dps_deposits"]) {
        const { data } = await admin
          .from(table)
          .select("tenant_id")
          .neq("status", "draft")
          .gte("created_at", fromIso)
          .lt("created_at", toIso);
        tally(data as CountRow[] | null);
      }
      break;
    }

    case "sms_sent": {
      const { data } = await admin
        .from("scheduled_messages")
        .select("tenant_id")
        .eq("channel", "sms")
        .eq("status", "sent")
        .gte("sent_at", fromIso)
        .lt("sent_at", toIso);
      tally(data as CountRow[] | null);
      break;
    }
  }

  return counts;
}

/**
 * Tenants whose counters for this period must not be rewritten.
 *
 * Same rule as `canRegenerate` for invoices: once a bill has been issued, the
 * usage it was based on is part of a document somebody has received. Recounting
 * it afterwards would leave the counter and the invoice line disagreeing, with
 * no way to tell which the agency was actually charged.
 */
async function lockedTenants(period: BillingPeriod): Promise<Set<string>> {
  const admin = createSupabaseAdminClient();

  // Usage for the closed month lands on the invoice for the month that follows.
  const invoicePeriod =
    period.month === 12
      ? billingPeriod(period.year + 1, 1)
      : billingPeriod(period.year, period.month + 1);

  const { data } = await admin
    .from("tenant_platform_invoices")
    .select("tenant_id, status")
    .eq("period_year", invoicePeriod.year)
    .eq("period_month", invoicePeriod.month)
    .in("status", ["issued", "paid"]);

  return new Set((data ?? []).map((row) => row.tenant_id as string));
}

export async function runUsageRollup(
  options: { force?: boolean } = {}
): Promise<UsageRollupSummary> {
  const startedAt = Date.now();
  const now = new Date();

  // Restricted to the 1st for the same reason as platform-invoices: the cron
  // expression runs on server time while the business month is London's, and
  // this is callable by hand. `force` exists for backfilling a month that was
  // missed, which is a deliberate act.
  if (!options.force && !isLondonFirstOfMonth(now)) {
    return {
      ok: true,
      skipped: true,
      reason: "not the 1st in Europe/London",
      durationMs: Date.now() - startedAt,
    };
  }

  const admin = createSupabaseAdminClient();
  const period = previousBillingPeriod(currentBillingPeriod(now));

  const [{ data: tenants, error: tenantsError }, locked] = await Promise.all([
    admin.from("tenants").select("id"),
    lockedTenants(period),
  ]);

  if (tenantsError) throw new Error(tenantsError.message);

  // Count every meter across every tenant up front.
  const countsByMeter = new Map<MeterKey, Map<string, number>>();
  for (const meter of METERS) {
    countsByMeter.set(meter.key, await countMeter(meter, period));
  }

  const errors: { tenantId: string; error: string }[] = [];
  let countersWritten = 0;
  let totalBillablePence = 0;
  let skippedLocked = 0;

  const rows: Record<string, unknown>[] = [];

  for (const tenant of tenants ?? []) {
    const tenantId = tenant.id as string;

    if (locked.has(tenantId)) {
      skippedLocked += 1;
      continue;
    }

    for (const meter of METERS) {
      const quantity = countsByMeter.get(meter.key)?.get(tenantId) ?? 0;

      // No row for a meter nothing touched. An agency that sends no SMS should
      // not accumulate twelve zero rows a year, and its absence is unambiguous.
      if (quantity === 0) continue;

      const usage = priceUsage(meter, quantity);

      rows.push({
        tenant_id: tenantId,
        period_start: period.start,
        meter_key: usage.meterKey,
        quantity: usage.quantity,
        included: usage.included,
        billable: usage.billable,
        unit_price_pence: usage.unitPricePence,
        amount_pence: usage.amountPence,
        rolled_up_at: new Date().toISOString(),
      });

      totalBillablePence += usage.amountPence;
    }
  }

  // Upsert on the unique key, which is what makes a re-run idempotent: the
  // second pass recomputes the same numbers over the same rows.
  if (rows.length > 0) {
    const { error } = await admin
      .from("tenant_usage_counters")
      .upsert(rows, { onConflict: "tenant_id,period_start,meter_key" });

    if (error) {
      errors.push({ tenantId: "*", error: error.message });
    } else {
      countersWritten = rows.length;
    }
  }

  return {
    ok: true,
    period: { year: period.year, month: period.month },
    tenantsCounted: (tenants ?? []).length - skippedLocked,
    countersWritten,
    skippedLocked,
    totalBillablePence,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    durationMs: Date.now() - startedAt,
  };
}
