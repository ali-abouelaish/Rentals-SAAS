// Values stamped onto tenancy agreements.
//
//   npm test
//
// Each case here was a real misprint on a legal document: a UK date read
// American-style, a statutory deadline a day early across the spring clock
// change, and the agreed rent unavailable to the template at all.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ContractTemplateField } from "../domain/types.ts";
import { addDaysIso, resolveFieldValue, ukToday, type ResolverContext } from "./resolver.ts";

function field(over: Partial<ContractTemplateField>): ContractTemplateField {
  return {
    id: "f",
    tenant_id: "t",
    template_id: "tpl",
    label: "Field",
    page_index: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 12,
    field_kind: "data",
    signer_role: null,
    source: "manual",
    question_id: null,
    data_key: null,
    manual_key: null,
    manual_default: null,
    format: "text",
    font_size: 10,
    font_weight: "normal",
    text_align: "left",
    truncate_overflow: true,
    ai_confidence: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function ctx(over: Partial<ResolverContext> = {}): ResolverContext {
  return {
    booking: { id: "b", applicant_name: null, applicant_email: null, applicant_phone: null, submitted_at: null },
    unit: null,
    property: null,
    landlord: null,
    agency: null,
    pmTenant: null,
    responses: new Map(),
    manualValues: {},
    contractId: "c1",
    standingOrderRef: null,
    terms: {
      start_date: "2026-03-10",
      expiry_date: null,
      rent_pcm: 650,
      deposit: 750,
      collection_date: 1,
      deposit_scheme: "dps",
    },
    ...over,
  };
}

describe("addDaysIso", () => {
  it("counts calendar days across the spring clock change", () => {
    // The old Date/setDate mix returned 2026-04-08 on a UK-time server.
    assert.equal(addDaysIso("2026-03-10", 30), "2026-04-09");
  });

  it("crosses month and year ends", () => {
    assert.equal(addDaysIso("2026-12-15", 30), "2027-01-14");
    assert.equal(addDaysIso("2028-02-28", 1), "2028-02-29");
  });

  it("returns blank for something that isn't a date", () => {
    assert.equal(addDaysIso("soon", 30), "");
  });
});

describe("ukToday", () => {
  it("uses the UK calendar date, not UTC", () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in London (BST).
    assert.equal(ukToday(new Date("2026-06-30T23:30:00Z")), "2026-07-01");
  });
});

describe("date fields", () => {
  const manualDate = (value: string) =>
    resolveFieldValue(field({ manual_key: "d", format: "date" }), ctx({ manualValues: { d: value } }));

  it("reads slash dates day-first", () => {
    assert.equal(manualDate("10/11/2026"), "10 November 2026");
  });

  it("formats ISO dates without a timezone shift", () => {
    assert.equal(manualDate("2026-11-10"), "10 November 2026");
  });

  it("prints impossible or free-text dates as typed rather than guessing", () => {
    assert.equal(manualDate("31/02/2026"), "31/02/2026");
    assert.equal(manualDate("1st of the month"), "1st of the month");
  });
});

describe("contract terms", () => {
  const term = (key: string, format: ContractTemplateField["format"] = "text") =>
    resolveFieldValue(field({ source: "contract", data_key: key, format }), ctx());

  it("stamps the agreed rent and deposit", () => {
    assert.equal(term("contract.rent_pcm", "currency_gbp"), "£650");
    assert.equal(term("contract.deposit", "currency_gbp"), "£750");
  });

  it("stamps the tenancy dates, blank for a rolling tenancy", () => {
    assert.equal(term("contract.start_date", "date"), "10 March 2026");
    assert.equal(term("contract.expiry_date", "date"), "");
  });

  it("writes the rent day as an ordinal", () => {
    assert.equal(term("contract.collection_date"), "1st");
    const on = (d: number) =>
      resolveFieldValue(
        field({ source: "contract", data_key: "contract.collection_date" }),
        ctx({ terms: { ...ctx().terms, collection_date: d } }),
      );
    assert.deepEqual([2, 3, 11, 12, 13, 22].map(on), ["2nd", "3rd", "11th", "12th", "13th", "22nd"]);
  });

  it("names the deposit scheme", () => {
    assert.equal(term("contract.deposit_scheme"), "Deposit Protection Service (DPS)");
  });

  it("computes the deposit protection deadline from the start date", () => {
    const value = resolveFieldValue(
      field({ source: "computed", data_key: "computed.deposit_protection_deadline", format: "date" }),
      ctx(),
    );
    assert.equal(value, "09 April 2026");
  });
});

describe("currency", () => {
  it("accepts amounts typed with a pound sign or commas", () => {
    const v = resolveFieldValue(
      field({ manual_key: "amt", format: "currency_gbp" }),
      ctx({ manualValues: { amt: "£1,250" } }),
    );
    assert.equal(v, "£1,250");
  });
});
