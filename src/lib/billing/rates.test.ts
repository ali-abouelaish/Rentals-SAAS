// Platform billing periods, line building and regeneration safety.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  billingPeriod,
  buildInvoiceLines,
  canRegenerate,
  currentBillingPeriod,
  invoiceTotals,
  previousBillingPeriod,
  subscriptionBillable,
  type SubscriptionInput,
} from "./rates.ts";

const SEPT = billingPeriod(2026, 9);

function sub(over: Partial<SubscriptionInput> = {}): SubscriptionInput {
  return {
    integrationKey: "e_signing",
    name: "E-signing",
    status: "active",
    monthlyPricePence: 2900,
    isGrandfathered: false,
    billingStartsOn: "2026-08-01",
    endsOn: null,
    ...over,
  };
}

describe("billingPeriod", () => {
  it("spans the whole calendar month", () => {
    assert.equal(SEPT.start, "2026-09-01");
    assert.equal(SEPT.end, "2026-09-30");
  });

  it("gets 31-day months right", () => {
    assert.equal(billingPeriod(2026, 10).end, "2026-10-31");
  });

  it("gets February right in and out of a leap year", () => {
    assert.equal(billingPeriod(2026, 2).end, "2026-02-28");
    assert.equal(billingPeriod(2028, 2).end, "2028-02-29");
  });

  it("zero-pads so the strings compare correctly against date columns", () => {
    // Staleness and period matching are lexicographic string comparisons, so
    // "2026-9-01" would sort wrongly against "2026-10-01".
    const jan = billingPeriod(2026, 1);
    assert.equal(jan.start, "2026-01-01");
    assert.ok(jan.start < billingPeriod(2026, 10).start);
  });

  it("steps back across a year boundary", () => {
    const prev = previousBillingPeriod(billingPeriod(2027, 1));
    assert.equal(prev.year, 2026);
    assert.equal(prev.month, 12);
  });

  it("derives the current period in UTC", () => {
    const period = currentBillingPeriod(new Date("2026-09-13T12:00:00Z"));
    assert.equal(period.year, 2026);
    assert.equal(period.month, 9);
  });
});

describe("subscriptionBillable", () => {
  it("bills an ordinary active subscription", () => {
    assert.equal(subscriptionBillable(sub(), SEPT), true);
  });

  it("never bills a grandfathered agency", () => {
    // The grandfathering migration promised these stay free. Charging them
    // would break that promise silently, in money.
    assert.equal(subscriptionBillable(sub({ isGrandfathered: true }), SEPT), false);
  });

  it("never bills a free integration", () => {
    assert.equal(subscriptionBillable(sub({ monthlyPricePence: 0 }), SEPT), false);
  });

  it("does not bill before billing starts", () => {
    // Activated mid-September, billing starts 1 October. It must not appear on
    // the September invoice — the agency was told the rest of this month was
    // free.
    assert.equal(subscriptionBillable(sub({ billingStartsOn: "2026-10-01" }), SEPT), false);
  });

  it("bills the month billing starts in", () => {
    assert.equal(subscriptionBillable(sub({ billingStartsOn: "2026-09-01" }), SEPT), true);
  });

  it("does not bill a subscription with no billing start at all", () => {
    assert.equal(subscriptionBillable(sub({ billingStartsOn: null }), SEPT), false);
  });

  it("still bills a cancellation that runs to the end of this period", () => {
    // Cancellation is end-of-period: the agency keeps access for the month, so
    // the month is owed. Not charging here would give away a paid month.
    assert.equal(
      subscriptionBillable(sub({ status: "cancelled", endsOn: "2026-09-30" }), SEPT),
      true
    );
  });

  it("stops billing once the end date is behind us", () => {
    assert.equal(
      subscriptionBillable(sub({ status: "cancelled", endsOn: "2026-08-31" }), SEPT),
      false
    );
  });

  it("does not bill a cancellation with no end date", () => {
    // Shouldn't happen — cancelling always sets one — but billing a
    // subscription with no paid period to point at is indefensible.
    assert.equal(subscriptionBillable(sub({ status: "cancelled", endsOn: null }), SEPT), false);
  });
});

describe("buildInvoiceLines", () => {
  const purchase = (over: Partial<{ id: string; billingPeriod: string }> = {}) => ({
    id: "p1",
    envelopes: 100,
    pricePence: 8000,
    billingPeriod: "2026-09-01",
    ...over,
  });

  it("includes subscriptions and purchases together", () => {
    const lines = buildInvoiceLines({
      subscriptions: [sub()],
      purchases: [purchase()],
      period: SEPT,
    });
    assert.equal(lines.length, 2);
    assert.equal(lines[0].kind, "integration");
    assert.equal(lines[1].kind, "envelopes");
  });

  it("matches purchases on their stamped billing period, not this one", () => {
    // A purchase made on 30 September was told it would land on the October
    // invoice, and that promise is what the agency saw in the dialog.
    const lines = buildInvoiceLines({
      subscriptions: [],
      purchases: [purchase({ billingPeriod: "2026-10-01" })],
      period: SEPT,
    });
    assert.equal(lines.length, 0);
  });

  it("traces every line back to what produced it", () => {
    // Without this a voided invoice can't release its purchases, and nobody
    // can answer "which invoice billed this?".
    const lines = buildInvoiceLines({
      subscriptions: [sub()],
      purchases: [purchase({ id: "purchase-abc" })],
      period: SEPT,
    });
    assert.equal(lines[0].sourceKind, "integration_subscription");
    assert.equal(lines[0].sourceRef, "e_signing");
    assert.equal(lines[1].sourceKind, "envelope_purchase");
    assert.equal(lines[1].sourceRef, "purchase-abc");
  });

  it("produces nothing for an agency that owes nothing", () => {
    const lines = buildInvoiceLines({
      subscriptions: [sub({ isGrandfathered: true })],
      purchases: [],
      period: SEPT,
    });
    assert.deepEqual(lines, []);
  });
});

describe("invoiceTotals", () => {
  const lines = buildInvoiceLines({
    subscriptions: [sub(), sub({ integrationKey: "tds", name: "TDS", monthlyPricePence: 1500 })],
    purchases: [{ id: "p1", envelopes: 100, pricePence: 8000, billingPeriod: "2026-09-01" }],
    period: SEPT,
  });

  it("sums the lines", () => {
    assert.equal(invoiceTotals(lines, 0).subtotalPence, 2900 + 1500 + 8000);
  });

  it("adds no VAT at a zero rate", () => {
    const totals = invoiceTotals(lines, 0);
    assert.equal(totals.vatPence, 0);
    assert.equal(totals.totalPence, totals.subtotalPence);
  });

  it("computes VAT on the subtotal, not per line", () => {
    // Rounding each line and summing drifts from the figure an accountant
    // expects on a multi-line invoice.
    const totals = invoiceTotals(lines, 2000);
    assert.equal(totals.subtotalPence, 12400);
    assert.equal(totals.vatPence, 2480);
    assert.equal(totals.totalPence, 14880);
  });

  it("rounds VAT to whole pence", () => {
    const totals = invoiceTotals(
      [
        {
          kind: "integration",
          description: "x",
          quantity: 1,
          unitPricePence: 999,
          amountPence: 999,
        },
      ],
      2000
    );
    // 999 * 0.2 = 199.8
    assert.equal(totals.vatPence, 200);
    assert.ok(Number.isInteger(totals.totalPence));
  });

  it("totals an empty invoice to zero rather than NaN", () => {
    assert.equal(invoiceTotals([], 2000).totalPence, 0);
  });
});

describe("canRegenerate", () => {
  it("allows a first generation", () => {
    assert.equal(canRegenerate(null), true);
    assert.equal(canRegenerate(undefined), true);
  });

  it("allows a draft to be rebuilt", () => {
    assert.equal(canRegenerate("draft"), true);
  });

  it("refuses to rewrite anything already issued", () => {
    // The rule the whole module exists to protect. Silently rewriting a bill
    // the agency is holding — or has paid — is how a billing system loses a
    // customer. Correcting one is a deliberate void-and-reissue.
    assert.equal(canRegenerate("issued"), false);
    assert.equal(canRegenerate("paid"), false);
  });

  it("refuses to rewrite a void invoice in place", () => {
    // A backstop rather than the live path: the generator filters voided
    // invoices out of its lookup entirely, so a voided month is replaced by a
    // NEW invoice (the unique index is partial on status <> 'void'). If a void
    // one ever did reach here, rewriting it would resurrect a charge somebody
    // deliberately cancelled.
    assert.equal(canRegenerate("void"), false);
  });
});
