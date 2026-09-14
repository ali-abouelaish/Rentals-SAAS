// The rules that decide whether an agency can use a paid feature, and when it
// starts being billed for it.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  endOfCurrentMonth,
  featureKeysFromRows,
  firstOfNextMonth,
  subscriptionGrantsAccess,
  type AccessRow,
} from "./access.ts";

const TODAY = "2026-09-09";

describe("subscriptionGrantsAccess", () => {
  it("grants on an active subscription", () => {
    assert.equal(
      subscriptionGrantsAccess({ status: "active", ends_on: null }, TODAY),
      true
    );
  });

  it("grants while setup is still outstanding", () => {
    // pending_setup must grant: the agency has subscribed, and the screen where
    // they finish connecting belongs to the gated feature. Withholding access
    // here would make the integration impossible to set up.
    assert.equal(
      subscriptionGrantsAccess({ status: "pending_setup", ends_on: null }, TODAY),
      true
    );
  });

  it("grants nothing without a subscription status it recognises", () => {
    assert.equal(
      subscriptionGrantsAccess({ status: "something_new", ends_on: null }, TODAY),
      false
    );
  });

  it("keeps a cancelled subscription alive until the period ends", () => {
    // The month is paid for. Cutting deposit protection the moment someone
    // clicks Cancel could strand a deposit inside its 30-day window.
    assert.equal(
      subscriptionGrantsAccess({ status: "cancelled", ends_on: "2026-09-30" }, TODAY),
      true
    );
  });

  it("grants on the last day of the period, and not the day after", () => {
    assert.equal(
      subscriptionGrantsAccess({ status: "cancelled", ends_on: "2026-09-09" }, TODAY),
      true
    );
    assert.equal(
      subscriptionGrantsAccess({ status: "cancelled", ends_on: "2026-09-08" }, TODAY),
      false
    );
  });

  it("never grants on a cancelled row with no end date", () => {
    // Shouldn't happen — cancelling always sets ends_on — but a row like this
    // would otherwise grant forever, which is the wrong direction to fail.
    assert.equal(
      subscriptionGrantsAccess({ status: "cancelled", ends_on: null }, TODAY),
      false
    );
  });

  it("expires an active subscription past its end date", () => {
    // A fixed-term or trial subscription. Status still says active; the date
    // is what settles it.
    assert.equal(
      subscriptionGrantsAccess({ status: "active", ends_on: "2026-08-31" }, TODAY),
      false
    );
  });
});

describe("featureKeysFromRows", () => {
  const lookup = (key: string) =>
    ({
      e_signing: ["e_signing"] as const,
      tds: ["tds"] as const,
      bundle: ["tds", "dps"] as const,
    })[key] ?? null;

  it("returns the features of granting rows only", () => {
    const rows: AccessRow[] = [
      { integration_key: "e_signing", status: "active", ends_on: null },
      { integration_key: "tds", status: "cancelled", ends_on: "2026-01-01" },
    ];
    assert.deepEqual(featureKeysFromRows(rows, lookup, TODAY), ["e_signing"]);
  });

  it("returns every feature an integration covers", () => {
    const rows: AccessRow[] = [
      { integration_key: "bundle", status: "active", ends_on: null },
    ];
    assert.deepEqual(featureKeysFromRows(rows, lookup, TODAY), ["tds", "dps"]);
  });

  it("grants nothing for an integration retired from the catalogue", () => {
    // An old row must not keep unlocking a feature after the integration it
    // referred to is gone.
    const rows: AccessRow[] = [
      { integration_key: "removed_last_year", status: "active", ends_on: null },
    ];
    assert.deepEqual(featureKeysFromRows(rows, lookup, TODAY), []);
  });

  it("grants nothing from no rows", () => {
    assert.deepEqual(featureKeysFromRows([], lookup, TODAY), []);
  });
});

describe("billing dates", () => {
  it("starts billing on the first of next month", () => {
    assert.equal(firstOfNextMonth(new Date("2026-09-09T12:00:00Z")), "2026-10-01");
  });

  it("rolls the year over in December", () => {
    assert.equal(firstOfNextMonth(new Date("2026-12-24T23:59:59Z")), "2027-01-01");
  });

  it("does not skip a month when activated on the 31st", () => {
    // Date arithmetic that adds a month to a day-of-month rather than to the
    // month number lands on 1 March from 31 January. Anchoring to day 1 of the
    // next month avoids it.
    assert.equal(firstOfNextMonth(new Date("2026-01-31T18:00:00Z")), "2026-02-01");
  });

  it("ends access on the last day of the current month", () => {
    assert.equal(endOfCurrentMonth(new Date("2026-09-09T12:00:00Z")), "2026-09-30");
    assert.equal(endOfCurrentMonth(new Date("2026-12-01T00:00:00Z")), "2026-12-31");
  });

  it("gets February right in and out of a leap year", () => {
    assert.equal(endOfCurrentMonth(new Date("2026-02-10T00:00:00Z")), "2026-02-28");
    assert.equal(endOfCurrentMonth(new Date("2028-02-10T00:00:00Z")), "2028-02-29");
  });

  it("leaves no gap between the end of one period and the start of the next", () => {
    // Cancel today, access to endOfCurrentMonth; reactivate today, billing from
    // firstOfNextMonth. The two must be consecutive days or the agency is
    // either billed for a day it cannot use, or uses a day nobody billed for.
    const now = new Date("2026-09-09T12:00:00Z");
    const end = new Date(`${endOfCurrentMonth(now)}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    assert.equal(end.toISOString().slice(0, 10), firstOfNextMonth(now));
  });
});
