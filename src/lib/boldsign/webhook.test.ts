// Signature verification tests.
//
//   npm test
//
// Run by node:test with Node's native type stripping (Node 24), so there is no
// test framework or transpiler dependency.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

import {
  computeBoldSignSignature,
  verifyBoldSignSignature,
  DEFAULT_TOLERANCE_SECONDS,
} from "./webhook.ts";

const SECRET = "test-webhook-secret";
const NOW = 1_756_000_000;
const BODY = JSON.stringify({
  event: { id: "evt_1", eventType: "Completed", environment: "Test" },
  data: { object: "document", documentId: "doc_1" },
});

function sign(body: string, timestamp: number, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function header(body: string, timestamp = NOW, secret = SECRET): string {
  return `t=${timestamp},s0=${sign(body, timestamp, secret)}`;
}

describe("computeBoldSignSignature", () => {
  it("hashes timestamp and body joined by a dot", () => {
    // Pinning the exact construction: this is the detail BoldSign's written
    // docs leave ambiguous, and getting it wrong fails silently on every event.
    const expected = createHmac("sha256", SECRET).update(`${NOW}.${BODY}`).digest("hex");
    assert.equal(computeBoldSignSignature(BODY, String(NOW), SECRET), expected);
  });

  it("is not the hash of the body alone", () => {
    const bodyOnly = createHmac("sha256", SECRET).update(BODY).digest("hex");
    assert.notEqual(computeBoldSignSignature(BODY, String(NOW), SECRET), bodyOnly);
  });
});

describe("verifyBoldSignSignature", () => {
  it("accepts a correctly signed payload", () => {
    const result = verifyBoldSignSignature(BODY, header(BODY), SECRET, { nowSeconds: NOW });
    assert.deepEqual(result, { ok: true, timestamp: NOW });
  });

  it("accepts an uppercase signature", () => {
    const upper = `t=${NOW},s0=${sign(BODY, NOW).toUpperCase()}`;
    const result = verifyBoldSignSignature(BODY, upper, SECRET, { nowSeconds: NOW });
    assert.equal(result.ok, true);
  });

  it("accepts the rotated s1 signature when s0 belongs to the old secret", () => {
    const s0 = sign(BODY, NOW, "previous-secret");
    const s1 = sign(BODY, NOW, SECRET);
    const result = verifyBoldSignSignature(BODY, `t=${NOW},s0=${s0},s1=${s1}`, SECRET, {
      nowSeconds: NOW,
    });
    assert.equal(result.ok, true);
  });

  it("tolerates spaces after the commas", () => {
    const spaced = `t=${NOW}, s0=${sign(BODY, NOW)}`;
    const result = verifyBoldSignSignature(BODY, spaced, SECRET, { nowSeconds: NOW });
    assert.equal(result.ok, true);
  });

  it("rejects a tampered body", () => {
    const tampered = BODY.replace("doc_1", "doc_2");
    const result = verifyBoldSignSignature(tampered, header(BODY), SECRET, { nowSeconds: NOW });
    assert.deepEqual(result, { ok: false, reason: "signature_mismatch" });
  });

  it("rejects a re-serialised body even when the JSON is equivalent", () => {
    // The trap the whole module exists to avoid: parsing and re-stringifying
    // produces identical JSON semantically but a different byte sequence, and
    // therefore a different HMAC.
    const reserialised = JSON.stringify(JSON.parse(BODY), null, 2);
    const result = verifyBoldSignSignature(reserialised, header(BODY), SECRET, { nowSeconds: NOW });
    assert.deepEqual(result, { ok: false, reason: "signature_mismatch" });
  });

  it("rejects a signature made with the wrong secret", () => {
    const forged = `t=${NOW},s0=${sign(BODY, NOW, "wrong-secret")}`;
    const result = verifyBoldSignSignature(BODY, forged, SECRET, { nowSeconds: NOW });
    assert.deepEqual(result, { ok: false, reason: "signature_mismatch" });
  });

  it("rejects a signature bound to a different timestamp", () => {
    const replayed = `t=${NOW + 1},s0=${sign(BODY, NOW)}`;
    const result = verifyBoldSignSignature(BODY, replayed, SECRET, { nowSeconds: NOW });
    assert.deepEqual(result, { ok: false, reason: "signature_mismatch" });
  });

  it("rejects a short signature without throwing", () => {
    // timingSafeEqual throws on unequal buffer lengths; the SDK's own helper
    // has this bug, turning a malformed forgery into a 500.
    const result = verifyBoldSignSignature(BODY, `t=${NOW},s0=abc`, SECRET, { nowSeconds: NOW });
    assert.deepEqual(result, { ok: false, reason: "signature_mismatch" });
  });

  it("rejects a missing header", () => {
    assert.deepEqual(verifyBoldSignSignature(BODY, null, SECRET), {
      ok: false,
      reason: "missing_header",
    });
    assert.deepEqual(verifyBoldSignSignature(BODY, "   ", SECRET), {
      ok: false,
      reason: "missing_header",
    });
  });

  it("rejects a malformed header", () => {
    assert.deepEqual(verifyBoldSignSignature(BODY, "garbage", SECRET), {
      ok: false,
      reason: "malformed_header",
    });
  });

  it("rejects a header with no timestamp", () => {
    assert.deepEqual(verifyBoldSignSignature(BODY, `s0=${sign(BODY, NOW)}`, SECRET), {
      ok: false,
      reason: "missing_timestamp",
    });
  });

  it("rejects a non-numeric timestamp", () => {
    assert.deepEqual(verifyBoldSignSignature(BODY, `t=abc,s0=${sign(BODY, NOW)}`, SECRET), {
      ok: false,
      reason: "missing_timestamp",
    });
  });

  it("rejects a header carrying no signature", () => {
    assert.deepEqual(verifyBoldSignSignature(BODY, `t=${NOW}`, SECRET), {
      ok: false,
      reason: "missing_signature",
    });
  });

  it("rejects a stale timestamp outside the tolerance", () => {
    const result = verifyBoldSignSignature(BODY, header(BODY), SECRET, {
      nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS + 1,
    });
    assert.deepEqual(result, { ok: false, reason: "timestamp_out_of_tolerance" });
  });

  it("rejects a timestamp too far in the future", () => {
    const result = verifyBoldSignSignature(BODY, header(BODY), SECRET, {
      nowSeconds: NOW - DEFAULT_TOLERANCE_SECONDS - 1,
    });
    assert.deepEqual(result, { ok: false, reason: "timestamp_out_of_tolerance" });
  });

  it("accepts a timestamp at the edge of the tolerance", () => {
    const result = verifyBoldSignSignature(BODY, header(BODY), SECRET, {
      nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS,
    });
    assert.equal(result.ok, true);
  });

  it("verifies an empty body", () => {
    const result = verifyBoldSignSignature("", header(""), SECRET, { nowSeconds: NOW });
    assert.equal(result.ok, true);
  });
});

describe("cross-compatibility with the BoldSign SDK", () => {
  // Guards against an SDK update changing the scheme underneath us. The helper
  // lives at a deep path because it is not exported from the package entry.
  const require_ = createRequire(import.meta.url);
  const { WebhookUtility } = require_("boldsign/dist/WebhookUtility") as {
    WebhookUtility: {
      validateSignature(body: string, header: string, secret: string, tolerance?: number): void;
    };
  };

  it("produces a signature the SDK's own validator accepts", () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = computeBoldSignSignature(BODY, String(now), SECRET);
    assert.doesNotThrow(() =>
      WebhookUtility.validateSignature(BODY, `t=${now},s0=${signature}`, SECRET)
    );
  });

  it("accepts what the SDK accepts", () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", SECRET).update(`${now}.${BODY}`).digest("hex");
    const header_ = `t=${now},s0=${signature}`;
    assert.doesNotThrow(() => WebhookUtility.validateSignature(BODY, header_, SECRET));
    assert.equal(verifyBoldSignSignature(BODY, header_, SECRET).ok, true);
  });

  it("returns cleanly where the SDK throws RangeError", () => {
    const now = Math.floor(Date.now() / 1000);
    // The reason this module doesn't just delegate to WebhookUtility.
    assert.throws(
      () => WebhookUtility.validateSignature(BODY, `t=${now},s0=abc`, SECRET),
      RangeError
    );
    assert.deepEqual(verifyBoldSignSignature(BODY, `t=${now},s0=abc`, SECRET), {
      ok: false,
      reason: "signature_mismatch",
    });
  });
});
