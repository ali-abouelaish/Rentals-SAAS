import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed tenant-portal tokens (renter magic links + sessions).
 *
 * Format: base64url(JSON.stringify(claims)) + "." + base64url(hmac)
 *
 * No DB storage; the HMAC signature *is* the authentication. Unlike
 * preference tokens these DO expire (`exp` claim) — a leaked magic link is
 * only useful for 20 minutes, a session cookie for 30 days. Rotating
 * PORTAL_TOKEN_SECRET invalidates every outstanding token at once.
 */

const ALG = "sha256";

export const LOGIN_TOKEN_TTL_MS = 20 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 3600_000;
export const SUPPORT_CTX_TTL_MS = 10 * 60_000;

export type PortalTokenType = "login" | "session" | "support";

export type PortalTokenClaims = {
  typ: PortalTokenType;
  pmTenantId: string;
  tenantId: string;
  /** Lowercased pm_tenant email; login tokens only. Redemption re-checks it
   *  against pm_tenants.email so staff correcting an address invalidates
   *  outstanding links. */
  email?: string;
  issuedAt: number;
  expiresAt: number;
};

function getSecret(): Buffer {
  const secret = process.env.PORTAL_TOKEN_SECRET;
  if (!secret) {
    throw new Error("PORTAL_TOKEN_SECRET is not set");
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

export function signPortalToken(
  claims: Pick<PortalTokenClaims, "typ" | "pmTenantId" | "tenantId" | "email">,
  ttlMs: number
): string {
  if (!claims.pmTenantId) throw new Error("pmTenantId is required");
  if (!claims.tenantId) throw new Error("tenantId is required");
  const now = Date.now();
  const payload = base64url(
    JSON.stringify({
      typ: claims.typ,
      t: claims.pmTenantId,
      a: claims.tenantId,
      ...(claims.email ? { e: claims.email.toLowerCase() } : {}),
      iat: now,
      exp: now + ttlMs,
    })
  );
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

/**
 * Constant-time signature verification. Returns null on any failure
 * (malformed, bad signature, wrong type, expired, missing claim) — never
 * throws.
 */
export function verifyPortalToken(
  token: string,
  expectedTyp: PortalTokenType
): PortalTokenClaims | null {
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
    const parsed = JSON.parse(json) as {
      typ?: unknown;
      t?: unknown;
      a?: unknown;
      e?: unknown;
      iat?: unknown;
      exp?: unknown;
    };
    if (parsed.typ !== expectedTyp) return null;
    if (typeof parsed.t !== "string" || typeof parsed.a !== "string") return null;
    if (typeof parsed.iat !== "number" || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return {
      typ: expectedTyp,
      pmTenantId: parsed.t,
      tenantId: parsed.a,
      email: typeof parsed.e === "string" ? parsed.e : undefined,
      issuedAt: parsed.iat,
      expiresAt: parsed.exp,
    };
  } catch {
    return null;
  }
}
