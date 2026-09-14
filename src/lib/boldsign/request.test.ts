// Send-request construction and validation.
//
//   npm test
//
// This covers the mapping decisions that would otherwise only be caught by
// sending a real document to a real person: field types, coordinates, the
// sandbox flag, and the metadata the webhook handler relies on.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSendRequest, toFormField, validateSendInput } from "./request.ts";
import type { SendForSignatureInput } from "./types.ts";

const BASE: SendForSignatureInput = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  entityType: "contract",
  entityId: "22222222-2222-2222-2222-222222222222",
  title: "Tenancy agreement",
  pdf: Buffer.from("%PDF-1.7 fake"),
  fileName: "tenancy.pdf",
  signers: [
    {
      name: "A Tenant",
      email: "tenant@example.com",
      fields: [{ type: "Signature", pageNumber: 1, x: 60, y: 90, width: 180, height: 40 }],
    },
  ],
};

const CONTEXT = { brandId: null, onBehalfOf: null, isSandbox: true };

describe("validateSendInput", () => {
  it("accepts a well-formed request", () => {
    assert.equal(validateSendInput(BASE), null);
  });

  it("rejects a request with no signers", () => {
    assert.match(validateSendInput({ ...BASE, signers: [] }) ?? "", /at least one signer/i);
  });

  it("rejects a signer with no email", () => {
    const input = { ...BASE, signers: [{ ...BASE.signers[0], email: "  " }] };
    assert.match(validateSendInput(input) ?? "", /no email address/i);
  });

  it("rejects a signer with no field to sign", () => {
    // BoldSign would accept this and the signer could never complete it.
    const input = { ...BASE, signers: [{ ...BASE.signers[0], fields: [] }] };
    assert.match(validateSendInput(input) ?? "", /no signature field/i);
  });

  it("rejects an empty document", () => {
    assert.match(validateSendInput({ ...BASE, pdf: Buffer.alloc(0) }) ?? "", /empty/i);
  });

  it("names the offending signer, not just the problem", () => {
    const input = {
      ...BASE,
      signers: [BASE.signers[0], { name: "A Landlord", email: "", fields: [] }],
    };
    assert.match(validateSendInput(input) ?? "", /A Landlord/);
  });
});

describe("toFormField", () => {
  it("passes coordinates through unflipped", () => {
    // Harbor Ops and BoldSign both use a top-left origin (confirmed visually
    // against the sandbox), so a y-flip here would be a bug.
    const field = toFormField({
      type: "Signature",
      pageNumber: 2,
      x: 60,
      y: 90,
      width: 180,
      height: 40,
    });
    assert.deepEqual(
      { x: field.bounds.x, y: field.bounds.y, w: field.bounds.width, h: field.bounds.height },
      { x: 60, y: 90, w: 180, h: 40 }
    );
    assert.equal(field.pageNumber, 2);
  });

  it("rounds fractional bounds, which BoldSign rejects", () => {
    const field = toFormField({
      type: "Signature",
      pageNumber: 1,
      x: 60.4,
      y: 90.6,
      width: 180.5,
      height: 39.2,
    });
    for (const value of [field.bounds.x, field.bounds.y, field.bounds.width, field.bounds.height]) {
      assert.equal(Number.isInteger(value), true, `${value} should be an integer`);
    }
  });

  it("maps each field type to the SDK's string value, not a number", () => {
    // The generated .d.ts declares FieldTypeEnum as numeric while the .js
    // assigns strings; sending a number would be silently wrong.
    for (const type of ["Signature", "Initial", "DateSigned"] as const) {
      const field = toFormField({ type, pageNumber: 1, x: 0, y: 0, width: 10, height: 10 });
      assert.equal(field.fieldType as unknown as string, type);
    }
  });

  it("defaults fields to required", () => {
    const field = toFormField({ type: "Signature", pageNumber: 1, x: 0, y: 0, width: 1, height: 1 });
    assert.equal(field.isRequired, true);
  });

  it("honours an explicit isRequired: false", () => {
    const field = toFormField({
      type: "Initial",
      pageNumber: 1,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      isRequired: false,
    });
    assert.equal(field.isRequired, false);
  });
});

describe("buildSendRequest", () => {
  it("carries the correlation metadata the webhook handler depends on", () => {
    const request = buildSendRequest(BASE, CONTEXT);
    assert.deepEqual(request.metaData, {
      tenantId: BASE.tenantId,
      entityType: "contract",
      entityId: BASE.entityId,
    });
  });

  it("marks the request as sandbox when the environment is sandbox", () => {
    assert.equal(buildSendRequest(BASE, CONTEXT).isSandbox, true);
  });

  it("marks the request as live when the environment is live", () => {
    // The flag that stops a misconfigured deployment issuing binding agreements.
    assert.equal(buildSendRequest(BASE, { ...CONTEXT, isSandbox: false }).isSandbox, false);
  });

  it("attaches the document as a single PDF file", () => {
    const request = buildSendRequest(BASE, CONTEXT);
    assert.equal(request.files?.length, 1);
    const file = request.files?.[0] as { options: { filename: string; contentType: string } };
    assert.equal(file.options.filename, "tenancy.pdf");
    assert.equal(file.options.contentType, "application/pdf");
  });

  it("omits brandId and onBehalfOf when the agency has no identity", () => {
    const request = buildSendRequest(BASE, CONTEXT);
    assert.equal(request.brandId, undefined);
    assert.equal(request.onBehalfOf, undefined);
  });

  it("applies the agency's brand and verified sender when present", () => {
    const request = buildSendRequest(BASE, {
      brandId: "brand-a",
      onBehalfOf: "agency@example.com",
      isSandbox: true,
    });
    assert.equal(request.brandId, "brand-a");
    assert.equal(request.onBehalfOf, "agency@example.com");
  });

  it("builds one signer per input signer, each with its own fields", () => {
    const input: SendForSignatureInput = {
      ...BASE,
      enableSigningOrder: true,
      signers: [
        { ...BASE.signers[0], order: 1 },
        {
          name: "A Landlord",
          email: "landlord@example.com",
          order: 2,
          fields: [
            { type: "Signature", pageNumber: 1, x: 300, y: 90, width: 180, height: 40 },
            { type: "DateSigned", pageNumber: 1, x: 300, y: 140, width: 120, height: 20 },
          ],
        },
      ],
    };
    const request = buildSendRequest(input, CONTEXT);
    assert.equal(request.signers?.length, 2);
    assert.equal(request.signers?.[0].emailAddress, "tenant@example.com");
    assert.equal(request.signers?.[1].formFields?.length, 2);
    assert.equal(request.signers?.[1].signerOrder, 2);
    assert.equal(request.enableSigningOrder, true);
  });

  it("leaves signing order off unless asked", () => {
    // The SDK's constructor initialises this to false, so assert the meaning
    // ("not enabled") rather than a specific falsy value.
    assert.notEqual(buildSendRequest(BASE, CONTEXT).enableSigningOrder, true);
  });

  it("passes an expiry through only when set", () => {
    assert.equal(buildSendRequest(BASE, CONTEXT).expiryDays, undefined);
    assert.equal(buildSendRequest({ ...BASE, expiryDays: 14 }, CONTEXT).expiryDays, 14);
  });
});
