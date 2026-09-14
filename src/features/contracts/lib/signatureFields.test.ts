// Grouping template signature fields into BoldSign signers.
//
//   npm test
//
// The failure this guards against is quiet and serious: a landlord's signature
// box appearing on the tenant's signing session, or a field landing on the
// wrong page of a tenancy agreement.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupSignatureFieldsByRole, type TemplateSignatureField } from "./signatureFields.ts";

function field(over: Partial<TemplateSignatureField> = {}): TemplateSignatureField {
  return {
    field_kind: "signature",
    signer_role: "tenant",
    page_index: 0,
    x: 60,
    y: 700,
    width: 180,
    height: 40,
    ...over,
  };
}

describe("groupSignatureFieldsByRole", () => {
  it("returns nothing when the template has no signature fields", () => {
    assert.deepEqual(groupSignatureFieldsByRole([]), []);
    assert.deepEqual(groupSignatureFieldsByRole([field({ field_kind: "data" })]), []);
  });

  it("converts the 0-based editor page index to BoldSign's 1-based page", () => {
    const [group] = groupSignatureFieldsByRole([field({ page_index: 0 })]);
    assert.equal(group.fields[0].pageNumber, 1);

    const [later] = groupSignatureFieldsByRole([field({ page_index: 4 })]);
    assert.equal(later.fields[0].pageNumber, 5);
  });

  it("passes coordinates straight through", () => {
    // Both sides use PDF points with a top-left origin, so any arithmetic here
    // would be a bug.
    const [group] = groupSignatureFieldsByRole([
      field({ x: 61.5, y: 702.25, width: 180, height: 40 }),
    ]);
    assert.deepEqual(
      {
        x: group.fields[0].x,
        y: group.fields[0].y,
        width: group.fields[0].width,
        height: group.fields[0].height,
      },
      { x: 61.5, y: 702.25, width: 180, height: 40 }
    );
  });

  it("maps each field kind to its BoldSign type", () => {
    const groups = groupSignatureFieldsByRole([
      field({ field_kind: "signature" }),
      field({ field_kind: "initial" }),
      field({ field_kind: "date_signed" }),
    ]);
    assert.deepEqual(
      groups[0].fields.map((f) => f.type),
      ["Signature", "Initial", "DateSigned"]
    );
  });

  it("keeps each party's fields separate", () => {
    const groups = groupSignatureFieldsByRole([
      field({ signer_role: "tenant", x: 60 }),
      field({ signer_role: "landlord", x: 300 }),
      field({ signer_role: "tenant", field_kind: "date_signed", x: 60, y: 760 }),
    ]);
    assert.equal(groups.length, 2);
    const tenant = groups.find((g) => g.role === "tenant");
    const landlord = groups.find((g) => g.role === "landlord");
    assert.equal(tenant?.fields.length, 2);
    assert.equal(landlord?.fields.length, 1);
    assert.equal(landlord?.fields[0].x, 300);
  });

  it("orders signers tenant, guarantor, landlord", () => {
    // The landlord countersigns, so they come last regardless of the order the
    // fields happen to be stored in.
    const groups = groupSignatureFieldsByRole([
      field({ signer_role: "landlord" }),
      field({ signer_role: "tenant" }),
      field({ signer_role: "guarantor" }),
    ]);
    assert.deepEqual(
      groups.map((g) => g.role),
      ["tenant", "guarantor", "landlord"]
    );
  });

  it("omits roles the template does not use", () => {
    const groups = groupSignatureFieldsByRole([field({ signer_role: "landlord" })]);
    assert.deepEqual(
      groups.map((g) => g.role),
      ["landlord"]
    );
  });

  it("drops a signature field with no signer rather than attributing it", () => {
    // Unreachable through the editor, which requires a signer — but a
    // hand-edited row must not put an unattributed signature box on a contract.
    assert.deepEqual(groupSignatureFieldsByRole([field({ signer_role: null })]), []);
  });

  it("ignores data fields mixed in with signature fields", () => {
    const groups = groupSignatureFieldsByRole([
      field({ field_kind: "data", signer_role: null }),
      field({ signer_role: "tenant" }),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].fields.length, 1);
  });

  it("treats a missing field_kind as a data field", () => {
    // Migrations are applied by hand, so between deploy and migration the
    // column is absent. Reading undefined as a signature field would put
    // phantom signature boxes on every merge field.
    const legacy = { ...field(), field_kind: undefined } as unknown as TemplateSignatureField;
    assert.deepEqual(groupSignatureFieldsByRole([legacy]), []);
  });

  it("marks every field required", () => {
    const groups = groupSignatureFieldsByRole([field(), field({ field_kind: "date_signed" })]);
    for (const spec of groups[0].fields) assert.equal(spec.isRequired, true);
  });
});
