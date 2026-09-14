// Envelope pack pricing and low-balance rules.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ENVELOPE_PACKS,
  EMPTY_BALANCE,
  LOW_BALANCE_THRESHOLD,
  MONTHLY_ALLOWANCE,
  formatPence,
  formatPerEnvelope,
  getEnvelopePack,
  isLowBalance,
  pricePerEnvelopePence,
} from "./packs.ts";

describe("pack catalogue", () => {
  it("has unique keys", () => {
    const keys = ENVELOPE_PACKS.map((p) => p.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("gets cheaper per envelope as the pack grows", () => {
    // The reason to buy the bigger pack. If a price edit ever broke this, the
    // dialog would be quietly advising people to buy the worse deal.
    const rates = ENVELOPE_PACKS.map(pricePerEnvelopePence);
    for (let i = 1; i < rates.length; i += 1) {
      assert.ok(
        rates[i] < rates[i - 1],
        `pack ${ENVELOPE_PACKS[i].key} is not better value than ${ENVELOPE_PACKS[i - 1].key}`
      );
    }
  });

  it("has a positive price and quantity on every pack", () => {
    for (const pack of ENVELOPE_PACKS) {
      assert.ok(pack.envelopes > 0, `${pack.key} has no envelopes`);
      assert.ok(pack.pricePence > 0, `${pack.key} is free`);
    }
  });

  it("returns null for a key that isn't in the catalogue", () => {
    // The purchase action trusts this to reject a tampered request.
    assert.equal(getEnvelopePack("pack_1000000"), null);
    assert.equal(getEnvelopePack(""), null);
  });
});

describe("formatting", () => {
  it("drops the decimals on whole pounds", () => {
    assert.equal(formatPence(2500), "£25");
    assert.equal(formatPence(8000), "£80");
  });

  it("keeps them when there are pence", () => {
    assert.equal(formatPence(175), "£1.75");
    assert.equal(formatPence(70), "£0.70");
  });

  it("handles zero", () => {
    assert.equal(formatPence(0), "£0");
  });

  it("rounds the per-envelope rate to the nearest penny", () => {
    // 250 for £175 is 70p exactly; 100 for £80 is 80p. Display only — billing
    // uses the pack price as one integer, so no rounding accumulates.
    const pack250 = getEnvelopePack("pack_250")!;
    assert.equal(formatPerEnvelope(pack250), "£0.70 each");
  });
});

describe("isLowBalance", () => {
  const at = (remaining: number) => ({ ...EMPTY_BALANCE, remaining });

  it("is low at and below the threshold", () => {
    assert.equal(isLowBalance(at(LOW_BALANCE_THRESHOLD)), true);
    assert.equal(isLowBalance(at(1)), true);
  });

  it("is not low above the threshold", () => {
    assert.equal(isLowBalance(at(LOW_BALANCE_THRESHOLD + 1)), false);
    assert.equal(isLowBalance(at(MONTHLY_ALLOWANCE)), false);
  });

  it("is not 'low' at zero", () => {
    // Zero is a different state with different copy and a different button —
    // "running out" and "stopped" should not render the same warning.
    assert.equal(isLowBalance(at(0)), false);
  });
});
