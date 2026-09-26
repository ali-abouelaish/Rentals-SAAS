/**
 * Platform billing rates and periods.
 *
 * Dependency-free so `node --test` can load it — the line-building and
 * regeneration rules below decide what an agency is charged, which is the last
 * place to be relying on manual checking.
 */

/**
 * VAT, in basis points. 2000 = 20%.
 *
 * Zero until Harbor Ops is VAT registered. It is stamped onto each invoice at
 * generation rather than read at display time, so raising it here changes only
 * invoices generated afterwards — history keeps the rate it was billed at.
 */
export const VAT_RATE_BPS = 0;

export type BillingPeriod = {
  year: number;
  month: number;
  /** First day, `YYYY-MM-DD`. */
  start: string;
  /** Last day, `YYYY-MM-DD`. */
  end: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function billingPeriod(year: number, month: number): BillingPeriod {
  // Day 0 of the next month is the last day of this one, which handles
  // 28/29/30/31 without a table of month lengths.
  const end = new Date(Date.UTC(year, month, 0));
  return {
    year,
    month,
    start: `${year}-${pad(month)}-01`,
    end: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
  };
}

/** The period containing `now` — what the monthly run bills. */
export function currentBillingPeriod(now: Date = new Date()): BillingPeriod {
  return billingPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

export function previousBillingPeriod(period: BillingPeriod): BillingPeriod {
  return period.month === 1
    ? billingPeriod(period.year - 1, 12)
    : billingPeriod(period.year, period.month - 1);
}

export function formatPeriod(period: BillingPeriod): string {
  return new Date(Date.UTC(period.year, period.month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ============================================================
// Line building
// ============================================================

export type InvoiceLineDraft = {
  kind: "integration" | "envelopes" | "adjustment" | "usage" | "plan";
  description: string;
  quantity: number;
  unitPricePence: number;
  amountPence: number;
  sourceKind?:
    | "integration_subscription"
    | "envelope_purchase"
    | "usage_counter"
    | "platform_charge";
  sourceRef?: string;
};

export type SubscriptionInput = {
  integrationKey: string;
  /** Display name, resolved from the catalogue by the caller. */
  name: string;
  status: string;
  monthlyPricePence: number;
  isGrandfathered: boolean;
  billingStartsOn: string | null;
  endsOn: string | null;
};

export type EnvelopePurchaseInput = {
  id: string;
  envelopes: number;
  pricePence: number;
  billingPeriod: string;
};

/**
 * A metered overage, already counted and priced by the rollup job.
 *
 * Everything here is read from `tenant_usage_counters` rather than recomputed:
 * the allowance and rate were frozen at rollup, and re-deriving them from the
 * meter catalogue at invoice time would re-price a month using today's numbers.
 */
export type UsageInput = {
  /** `tenant_usage_counters.id`, so a line traces back to the count. */
  id: string;
  meterKey: string;
  /** Display name, resolved from the meter catalogue by the caller. */
  name: string;
  /** Total consumed, including the included allowance. */
  quantity: number;
  /** Chargeable units above the allowance. */
  billable: number;
  unitPricePence: number;
  amountPence: number;
  /** First day of the month measured — the CLOSED month, not the billed one. */
  periodStart: string;
};

/**
 * Whether a subscription should appear on this period's invoice.
 *
 * Four ways a subscription earns nothing, and all four have bitten a billing
 * system somewhere:
 *
 *   - It is free or grandfathered. Charging a grandfathered agency would break
 *     the promise the grandfathering migration made.
 *   - It has not started billing yet. Activation is mid-month but billing
 *     starts on the 1st of the next, so a September activation must not appear
 *     on the September invoice.
 *   - It ended before this period began.
 *   - It was cancelled outright with no paid period left.
 *
 * A cancelled subscription whose `endsOn` falls inside this period IS charged:
 * the agency had access for it, which is the whole reason cancellation is
 * end-of-period rather than immediate.
 */
export function subscriptionBillable(
  subscription: SubscriptionInput,
  period: BillingPeriod
): boolean {
  if (subscription.isGrandfathered) return false;
  if (subscription.monthlyPricePence <= 0) return false;

  // Never billed a period before it starts.
  if (!subscription.billingStartsOn) return false;
  if (subscription.billingStartsOn > period.end) return false;

  // Access ended before this period opened.
  if (subscription.endsOn && subscription.endsOn < period.start) return false;

  // 'cancelled' with a future or in-period end date still bills; without an end
  // date it has no paid period to justify a charge.
  if (subscription.status === "cancelled" && !subscription.endsOn) return false;

  return true;
}

export function subscriptionLine(subscription: SubscriptionInput): InvoiceLineDraft {
  return {
    kind: "integration",
    description: subscription.name,
    quantity: 1,
    unitPricePence: subscription.monthlyPricePence,
    amountPence: subscription.monthlyPricePence,
    sourceKind: "integration_subscription",
    sourceRef: subscription.integrationKey,
  };
}

export function envelopeLine(purchase: EnvelopePurchaseInput): InvoiceLineDraft {
  return {
    kind: "envelopes",
    description: `${purchase.envelopes} signing envelopes`,
    quantity: 1,
    unitPricePence: purchase.pricePence,
    amountPence: purchase.pricePence,
    sourceKind: "envelope_purchase",
    sourceRef: purchase.id,
  };
}

export function usageLine(usage: UsageInput): InvoiceLineDraft {
  const month = new Date(`${usage.periodStart}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    kind: "usage",
    // Names the month measured, which is NOT the month being billed. Without
    // that, an October invoice showing September's overage looks like an error.
    description: `${usage.name} — ${usage.billable.toLocaleString("en-GB")} over included allowance (${month})`,
    quantity: usage.billable,
    unitPricePence: usage.unitPricePence,
    amountPence: usage.amountPence,
    sourceKind: "usage_counter",
    sourceRef: usage.id,
  };
}

/**
 * A recurring charge agreed with an agency: base plan fee, custom line, or an
 * ongoing discount (negative `amountPence`).
 *
 * Read from `tenant_platform_charges` rather than the code catalogue — this is
 * the half of an agency's bill that is negotiated rather than derived.
 */
export type PlatformChargeInput = {
  id: string;
  label: string;
  amountPence: number;
  billingStartsOn: string;
  endsOn: string | null;
};

/**
 * Whether an agreed charge applies to this period.
 *
 * Same window rule as `subscriptionBillable`, deliberately: a charge starting
 * mid-period bills from its first whole period, and one ending inside the period
 * still bills it, because the agency had the month.
 *
 * A zero amount raises no line — it is neither a charge nor a discount, and an
 * invoice reading "Harbor Ops Professional £0" invites a question nobody wants.
 */
export function chargeBillable(
  charge: PlatformChargeInput,
  period: BillingPeriod
): boolean {
  if (charge.amountPence === 0) return false;
  if (charge.billingStartsOn > period.end) return false;
  if (charge.endsOn && charge.endsOn < period.start) return false;
  return true;
}

export function platformChargeLine(charge: PlatformChargeInput): InvoiceLineDraft {
  return {
    kind: "plan",
    description: charge.label,
    quantity: 1,
    unitPricePence: charge.amountPence,
    amountPence: charge.amountPence,
    sourceKind: "platform_charge",
    sourceRef: charge.id,
  };
}

/**
 * Every line for one agency for one period.
 *
 * Purchases are matched on their own `billingPeriod`, which was stamped at the
 * point of sale, rather than on when they were bought. A purchase made on 30
 * September was told it would appear on the October invoice, and that promise
 * is what the agency saw in the dialog.
 *
 * Usage is passed in already filtered to the correct counters by the caller —
 * it is measured in arrears, so the counters belong to the month BEFORE this
 * period, and matching them here on `period.start` would find nothing.
 */
export function buildInvoiceLines(input: {
  subscriptions: SubscriptionInput[];
  purchases: EnvelopePurchaseInput[];
  usage?: UsageInput[];
  charges?: PlatformChargeInput[];
  period: BillingPeriod;
}): InvoiceLineDraft[] {
  const lines: InvoiceLineDraft[] = [];

  // Agreed charges lead the invoice: the base fee is the headline of the
  // relationship, and the catalogue add-ons below it read as additions to it.
  for (const charge of input.charges ?? []) {
    if (chargeBillable(charge, input.period)) {
      lines.push(platformChargeLine(charge));
    }
  }

  for (const subscription of input.subscriptions) {
    if (subscriptionBillable(subscription, input.period)) {
      lines.push(subscriptionLine(subscription));
    }
  }

  for (const purchase of input.purchases) {
    if (purchase.billingPeriod === input.period.start) {
      lines.push(envelopeLine(purchase));
    }
  }

  for (const usage of input.usage ?? []) {
    // A zero-amount overage raises no line. Every meter's rate is currently
    // zero, so this is what keeps metering invisible on invoices until a price
    // is actually set — and it also drops the "0 over allowance" noise line for
    // an agency comfortably inside its allowance.
    if (usage.amountPence > 0 && usage.billable > 0) {
      lines.push(usageLine(usage));
    }
  }

  return lines;
}

export type InvoiceTotals = {
  subtotalPence: number;
  vatRateBps: number;
  vatPence: number;
  totalPence: number;
};

/**
 * Totals for a set of lines.
 *
 * VAT is computed on the subtotal as a whole, not per line and summed —
 * rounding each line separately drifts from the figure an accountant expects
 * on a multi-line invoice.
 */
export function invoiceTotals(
  lines: InvoiceLineDraft[],
  vatRateBps: number = VAT_RATE_BPS
): InvoiceTotals {
  const subtotalPence = lines.reduce((sum, line) => sum + line.amountPence, 0);
  const vatPence = Math.round((subtotalPence * vatRateBps) / 10000);
  return {
    subtotalPence,
    vatRateBps,
    vatPence,
    totalPence: subtotalPence + vatPence,
  };
}

/**
 * Whether a regeneration may overwrite an existing invoice.
 *
 * The one rule that matters in the whole module. A draft is our working copy
 * and can be rebuilt freely. Anything issued has been sent to the agency, and
 * silently rewriting a bill somebody is already looking at — or has paid — is
 * the kind of error that ends a customer relationship. Correcting one of those
 * is a deliberate act: void it and raise a new one.
 */
export function canRegenerate(existingStatus: string | null | undefined): boolean {
  if (!existingStatus) return true;
  // 'void' should never reach here — the generator filters voided invoices out
  // so a voided month can be replaced. Refused anyway as a backstop: if one
  // ever did arrive, rewriting a cancelled invoice in place would resurrect a
  // charge somebody deliberately cancelled.
  return existingStatus === "draft";
}
