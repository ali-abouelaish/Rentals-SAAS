import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed preference tokens.
 *
 * Format: base64url(JSON.stringify({ t, iat })) + "." + base64url(hmac)
 *
 * No DB storage; the HMAC signature *is* the authentication. Tokens never
 * expire so links from old reminder emails keep working indefinitely. If we
 * ever need to revoke, rotate PREFERENCE_TOKEN_SECRET (which invalidates all
 * outstanding tokens at once).
 */

const ALG = "sha256";

function getSecret(): Buffer {
  const secret = process.env.PREFERENCE_TOKEN_SECRET;
  if (!secret) {
    throw new Error("PREFERENCE_TOKEN_SECRET is not set");
  }
  return Buffer.from(secret, "utf8");
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input as string | Buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string): Buffer {
  const pad = (4 - (input.length % 4)) % 4;
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

function sign(payload: string): string {
  const mac = createHmac(ALG, getSecret()).update(payload).digest();
  return base64url(mac);
}

export type PreferenceTokenClaims = {
  pmTenantId: string;
  issuedAt: number;
};

export function signPreferenceToken(pmTenantId: string): string {
  if (!pmTenantId) throw new Error("pmTenantId is required");
  const claims = { t: pmTenantId, iat: Date.now() };
  const payload = base64url(JSON.stringify(claims));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

/**
 * Constant-time signature verification. Returns null on any failure
 * (malformed, bad signature, missing claim) — never throws.
 */
export function verifyPreferenceToken(token: string): PreferenceTokenClaims | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const payload = token.slice(0, dot);
  const sigGiven = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(sigGiven);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const json = fromBase64url(payload).toString("utf8");
    const parsed = JSON.parse(json) as { t?: unknown; iat?: unknown };
    if (typeof parsed.t !== "string" || typeof parsed.iat !== "number") return null;
    return { pmTenantId: parsed.t, issuedAt: parsed.iat };
  } catch {
    return null;
  }
}
