// Monthly allowance periods and balance projection.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { currentPeriod, projectBalance, type StoredBalanceRow } from "./period.ts";

const ALLOWANCE = 20;

function row(over: Partial<StoredBalanceRow> = {}): StoredBalanceRow {
  return {
    allowance_period: "2026-09-01",
    allowance_total: ALLOWANCE,
    allowance_used: 0,
    topup_balance: 0,
    lifetime_sent: 0,
    ...over,
  };
}

describe("currentPeriod", () => {
  it("is the first of the month, in UTC", () => {
    assert.equal(currentPeriod(new Date("2026-09-12T14:00:00Z")), "2026-09-01");
    assert.equal(currentPeriod(new Date("2026-09-01T00:00:00Z")), "2026-09-01");
  });

  it("zero-pads single-digit months", () => {
    // Lexicographic comparison against the stored date column is how staleness
    // is decided, so "2026-9-01" would sort wrongly against "2026-10-01".
    assert.equal(currentPeriod(new Date("2026-01-15T00:00:00Z")), "2026-01-01");
  });

  it("does not roll back a day for a late-evening UTC time", () => {
    assert.equal(currentPeriod(new Date("2026-09-30T23:59:59Z")), "2026-09-01");
  });
});

describe("projectBalance", () => {
  it("reports the current month literally", () => {
    const result = projectBalance(row({ allowance_used: 7 }), "2026-09-01", ALLOWANCE);
    assert.equal(result.allowanceRemaining, 13);
    assert.equal(result.remaining, 13);
  });

  it("shows a full allowance once the month has rolled over", () => {
    // The row still says last month's allowance was fully spent. The database
    // only resets it on the next send, so rendering it literally would tell an
    // agency it has nothing on the morning of the 1st — and push it into
    // buying envelopes it already has.
    const stale = row({ allowance_period: "2026-08-01", allowance_used: ALLOWANCE });
    const result = projectBalance(stale, "2026-09-01", ALLOWANCE);
    assert.equal(result.allowanceRemaining, ALLOWANCE);
    assert.equal(result.remaining, ALLOWANCE);
  });

  it("does not carry unused allowance into the new month", () => {
    // The other direction: last month was barely used. It still resets to the
    // grant, not the grant plus what was left.
    const stale = row({ allowance_period: "2026-08-01", allowance_used: 2 });
    assert.equal(projectBalance(stale, "2026-09-01", ALLOWANCE).allowanceRemaining, ALLOWANCE);
  });

  it("keeps purchased envelopes across the month boundary", () => {
    // Top-ups never expire. A reset that wiped them would be taking back
    // something the agency paid for.
    const stale = row({
      allowance_period: "2026-08-01",
      allowance_used: ALLOWANCE,
      topup_balance: 40,
    });
    const result = projectBalance(stale, "2026-09-01", ALLOWANCE);
    assert.equal(result.topupRemaining, 40);
    assert.equal(result.remaining, ALLOWANCE + 40);
  });

  it("adds the two pools together", () => {
    const result = projectBalance(
      row({ allowance_used: 18, topup_balance: 5 }),
      "2026-09-01",
      ALLOWANCE
    );
    assert.equal(result.allowanceRemaining, 2);
    assert.equal(result.remaining, 7);
  });

  it("reports zero when both pools are empty", () => {
    const result = projectBalance(
      row({ allowance_used: ALLOWANCE, topup_balance: 0 }),
      "2026-09-01",
      ALLOWANCE
    );
    assert.equal(result.remaining, 0);
  });

  it("never lets an over-spent allowance eat into purchased envelopes", () => {
    // Happens if the plan's allowance is cut mid-period: used (20) now exceeds
    // total (10). Without the clamp the remainder is -10 and the agency's 30
    // paid envelopes silently read as 20.
    const result = projectBalance(
      row({ allowance_total: 10, allowance_used: 20, topup_balance: 30 }),
      "2026-09-01",
      ALLOWANCE
    );
    assert.equal(result.allowanceRemaining, 0);
    assert.equal(result.remaining, 30);
  });

  it("carries the lifetime counter through untouched", () => {
    const result = projectBalance(
      row({ allowance_period: "2026-01-01", lifetime_sent: 412 }),
      "2026-09-01",
      ALLOWANCE
    );
    assert.equal(result.lifetimeSent, 412);
  });
});
