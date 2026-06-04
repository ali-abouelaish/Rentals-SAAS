// PKCE (RFC 7636) + state helpers for the mydeposits OAuth authorization-code flow.

import { createHash, randomBytes } from "crypto";

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Cryptographically random PKCE code verifier (43–128 chars). */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/** S256 code challenge derived from a verifier. */
export function challengeFromVerifier(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

/** Opaque anti-CSRF state nonce. */
export function randomState(): string {
  return base64url(randomBytes(24));
}
