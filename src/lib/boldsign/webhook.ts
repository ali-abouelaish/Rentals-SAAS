// BoldSign webhook signature verification.
//
// Deliberately pure: the secret and the current time are arguments, not
// environment reads, and there is no "server-only" import. That keeps it
// directly unit-testable (src/lib/boldsign/webhook.test.ts) — which matters,
// because a signature check that silently passes everything looks identical to
// one that works until someone forges a payload.
//
// The scheme is taken from the SDK's own WebhookUtility:
//
//   header:   X-BoldSign-Signature: t=<unix-seconds>,s0=<hex>[,s1=<hex>]
//   expected: HMAC-SHA256(secret, `${timestamp}.${rawBody}`) as lowercase hex
//
// The `.` between timestamp and body is load-bearing and is not stated in
// BoldSign's written docs — it was read out of the SDK source.
//
// s1 is present while a secret is being rotated; either signature matching is
// a pass.
//
// This is reimplemented rather than calling WebhookUtility.validateSignature()
// for two reasons: that helper is not exported from the package entry point
// (it needs a deep import into boldsign/dist/), and it calls timingSafeEqual on
// buffers of unequal length, which throws a RangeError instead of returning
// false — so a malformed forgery would surface as a 500 rather than a clean
// rejection.

import { createHmac, timingSafeEqual } from "crypto";

/** BoldSign's own default tolerance, in seconds. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export const BOLDSIGN_SIGNATURE_HEADER = "x-boldsign-signature";
export const BOLDSIGN_EVENT_HEADER = "x-boldsign-event";

export type WebhookVerificationFailure =
  | "missing_header"
  | "malformed_header"
  | "missing_timestamp"
  | "missing_signature"
  | "signature_mismatch"
  | "timestamp_out_of_tolerance";

export type WebhookVerification =
  | { ok: true; timestamp: number }
  | { ok: false; reason: WebhookVerificationFailure };

/** Parse `t=…,s0=…,s1=…` into its parts. Values may repeat, hence arrays. */
function parseSignatureHeader(header: string): Record<string, string[]> | null {
  const parsed: Record<string, string[]> = {};
  for (const part of header.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) return null;
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    if (!value) return null;
    (parsed[key] ??= []).push(value);
  }
  return Object.keys(parsed).length > 0 ? parsed : null;
}

/**
 * Constant-time comparison that tolerates unequal lengths.
 *
 * timingSafeEqual throws on a length mismatch, so the length is checked first
 * — that leaks only the length of the signature, which is a fixed 64 hex
 * characters and therefore not a secret.
 */
function signatureMatches(expected: string, candidates: string[] | undefined): boolean {
  if (!candidates) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  let matched = false;
  for (const candidate of candidates) {
    const candidateBuffer = Buffer.from(candidate.trim().toLowerCase(), "utf8");
    if (candidateBuffer.length !== expectedBuffer.length) continue;
    // No early return: comparing every candidate keeps the work constant
    // regardless of which one matches.
    if (timingSafeEqual(candidateBuffer, expectedBuffer)) matched = true;
  }
  return matched;
}

export function computeBoldSignSignature(
  rawBody: string,
  timestamp: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")
    .toLowerCase();
}

/**
 * Verify an inbound BoldSign webhook.
 *
 * `rawBody` must be the request body exactly as received — never a re-serialised
 * object. `JSON.stringify(JSON.parse(body))` will change key order and
 * whitespace and produce a different HMAC.
 */
export function verifyBoldSignSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  options: { toleranceSeconds?: number; nowSeconds?: number } = {}
): WebhookVerification {
  if (!signatureHeader?.trim()) return { ok: false, reason: "missing_header" };

  const parts = parseSignatureHeader(signatureHeader);
  if (!parts) return { ok: false, reason: "malformed_header" };

  const timestamp = parts.t?.[0];
  if (!timestamp || !/^\d+$/.test(timestamp)) {
    return { ok: false, reason: "missing_timestamp" };
  }
  if (!parts.s0 && !parts.s1) return { ok: false, reason: "missing_signature" };

  const expected = computeBoldSignSignature(rawBody, timestamp, secret);
  if (!signatureMatches(expected, parts.s0) && !signatureMatches(expected, parts.s1)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  // Checked after the signature so an attacker can't use timing on this branch
  // to learn anything about the secret.
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  return { ok: true, timestamp: Number(timestamp) };
}
