// Pure derivation helpers for owner statements. No I/O — safe to unit test.
// Money is INTEGER PENCE throughout; pounds inputs (properties.monthly_rent_owed,
// owner_landlords.management_fee_amount) are converted with poundsToPence.
// Patterns mirror src/features/finances/data/queries.ts.

import { poundsToPence } from "@/lib/utils/formatters";
import type { FeeOverride, ManagementFeeConfig, OwnerTransaction } from "./types";

export { poundsToPence };

/**
 * Turns a payment schedule into the number of months each payment covers, so a
 * per-payment figure can be reduced to a monthly accrual. `monthly_rent_owed`
 * holds the amount paid PER PAYMENT despite its name, so a quarterly £3,000 is
 * £1,000 a month.
 *
 * Kept identical to the copies in src/features/finances/data/queries.ts and
 * .../actions/post-recurring.ts — the owner statement is the mirror image of
 * the agency-side `owner_rent` cost and the two must agree.
 */
export const SCHEDULE_DIVISOR: Record<
  "monthly" | "quarterly" | "biannual" | "annual",
  number
> = { monthly: 1, quarterly: 3, biannual: 6, annual: 12 };

/** Monthly rent owed to the landlord for one property, in pence. */
export function monthlyRentOwedPence(
  monthlyRentOwed: number | null | undefined,
  paymentSchedule: keyof typeof SCHEDULE_DIVISOR | null | undefined
): number {
  const divisor = paymentSchedule ? SCHEDULE_DIVISOR[paymentSchedule] ?? 1 : 1;
  return Math.round(poundsToPence(monthlyRentOwed) / divisor);
}

/** UTC month bounds as ISO yyyy-mm-dd strings (start..end inclusive). */
export function monthBounds(year: number, month: number): {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  daysInMonth: number;
} {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    start,
    end,
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10),
    daysInMonth: end.getUTCDate(),
  };
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The fee config actually in force for a statement.
 *
 * A statement may override the landlord's standing deal for one period (a
 * void month, a discount while works run). `fee_override_type` null means
 * "not overridden" and falls back to the owner's config; 'none' means the
 * agency deliberately charged nothing this period.
 */
export function effectiveFeeConfig(
  ownerConfig: ManagementFeeConfig,
  override: FeeOverride | null | undefined
): { config: ManagementFeeConfig; isOverridden: boolean } {
  if (!override || override.type == null) {
    return { config: ownerConfig, isOverridden: false };
  }
  return {
    config: {
      type: override.type,
      percent: override.percent ?? null,
      amount: override.amount ?? null,
    },
    isOverridden: true,
  };
}

/** Compute the management-fee line (pence) from a fee config. */
export function computeManagementFeePence(
  config: ManagementFeeConfig,
  rentReceivedPence: number
): number {
  if (config.type === "percent") {
    const pct = Number(config.percent ?? 0);
    if (!pct) return 0;
    return Math.round((rentReceivedPence * pct) / 100);
  }
  if (config.type === "flat") {
    return poundsToPence(config.amount);
  }
  return 0;
}

/** Line label for the fee, e.g. "Management fee (10%)". */
export function managementFeeLabel(config: ManagementFeeConfig, isOverridden: boolean): string {
  const base =
    config.type === "percent"
      ? `Management fee (${Number(config.percent ?? 0)}%)`
      : "Management fee";
  return isOverridden ? `${base} — adjusted for this period` : base;
}

export type StatementTotals = {
  rent: number;
  fee: number;
  works: number;
  other: number;
  /** Money remitted to the owner during the period. */
  paidToOwner: number;
  /** Signed net of manual adjustment lines (in − out). */
  adjustments: number;
  inTotal: number;
  outTotal: number;
  /** What the period earned the owner, before any carried balance or remittance. */
  netToOwner: number;
};

/**
 * Roll a set of ledger lines into the cached statement totals.
 *
 * Two figures, deliberately different, and both shown to the owner:
 *
 *   netToOwner = rent − (fee + works + other)
 *       what THIS period earned them.
 *   closing    = opening + netToOwner − paidToOwner + adjustments
 *       what is still owed once the carried balance, any remittance already
 *       made and manual corrections are applied. See closingBalance().
 *
 * Previously netToOwner ignored payments/adjustments while the closing balance
 * counted them via direction, so the two could not be reconciled on screen.
 */
export function summariseTransactions(
  txns: Pick<OwnerTransaction, "type" | "direction" | "amount_pence">[]
): StatementTotals {
  let rent = 0;
  let fee = 0;
  let works = 0;
  let other = 0;
  let paidToOwner = 0;
  let adjustments = 0;
  let inTotal = 0;
  let outTotal = 0;

  for (const t of txns) {
    if (t.direction === "in") inTotal += t.amount_pence;
    else outTotal += t.amount_pence;

    switch (t.type) {
      // Both count as the landlord's income side: rent_due is the contracted
      // figure the statement derives, rent_received an ad-hoc manual credit.
      case "rent_due":
      case "rent_received":
        rent += t.amount_pence;
        break;
      case "management_fee":
        fee += t.amount_pence;
        break;
      case "works_order":
        works += t.amount_pence;
        break;
      case "other_deduction":
        other += t.amount_pence;
        break;
      case "payment_to_owner":
        paidToOwner += t.amount_pence;
        break;
      case "adjustment":
        adjustments += t.direction === "in" ? t.amount_pence : -t.amount_pence;
        break;
      default:
        // opening_balance is carried in the statement column, not as a line.
        break;
    }
  }

  return {
    rent,
    fee,
    works,
    other,
    paidToOwner,
    adjustments,
    inTotal,
    outTotal,
    netToOwner: rent - fee - works - other,
  };
}

/**
 * Closing balance = what the agency still holds for the owner at period end.
 * Equivalent to `opening + inTotal − outTotal`, but written out so the on-screen
 * summary can show each step.
 */
export function closingBalance(opening: number, totals: StatementTotals): number {
  return opening + totals.netToOwner - totals.paidToOwner + totals.adjustments;
}
