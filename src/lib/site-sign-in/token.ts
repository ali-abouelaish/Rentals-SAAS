import { createHmac, randomUUID } from "crypto";

/**
 * Website sign-in tokens for the dashboard's Useful Resources links.
 *
 * A staff member opens an agency website's card; we form-post a 60-second
 * HS256 JWT to the site's sign-in URL, and the site verifies it with that
 * link's secret and starts its own session. The site needs no login page.
 *
 * The per-link secret is never stored: it's derived from QUICK_LINK_SSO_SECRET,
 * the link id and its sso_key_id, so tenant_quick_links stays readable by every
 * agency user without exposing anything that signs. A new sso_key_id is a new
 * secret; rotating QUICK_LINK_SSO_SECRET changes every site's secret at once.
 *
 * docs/website-sign-in.md is the spec for agency web developers — keep the
 * claim names and the form field in step with it.
 */

export const SITE_SIGN_IN_ISSUER = "harbor-ops";
export const SITE_SIGN_IN_TOKEN_FIELD = "harbor_token";
export const SITE_SIGN_IN_TTL_SECONDS = 60;

function getMasterKey(): Buffer {
  const secret = process.env.QUICK_LINK_SSO_SECRET;
  if (!secret) throw new Error("QUICK_LINK_SSO_SECRET env var is not set.");
  const key = Buffer.from(secret, "hex");
  if (key.length !== 32) {
    throw new Error("QUICK_LINK_SSO_SECRET must be a 32-byte hex string (64 hex chars).");
  }
  return key;
}

export function isSiteSignInConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input as string | Buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The secret the agency's website verifies with. Shown to admins on request; never stored. */
export function deriveSiteSecret(linkId: string, keyId: string): string {
  const mac = createHmac("sha256", getMasterKey())
    .update(`quick-link-sso:${linkId}:${keyId}`)
    .digest();
  return `hos_${base64url(mac)}`;
}

/** Plain RFC 7519 HS256; the key is the secret string's UTF-8 bytes, exactly as shown to the admin. */
export function signHs256Jwt(claims: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const sig = base64url(createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

export type SiteSignInUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isAdmin: boolean;
  tenantId: string;
};

export function signSiteSignInToken(input: {
  linkId: string;
  keyId: string;
  callbackUrl: string;
  returnTo: string;
  user: SiteSignInUser;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return signHs256Jwt(
    {
      iss: SITE_SIGN_IN_ISSUER,
      // The site checks this is its own origin, so a token can't be replayed
      // against a different website even if two ever shared a secret.
      aud: new URL(input.callbackUrl).origin,
      sub: input.user.id,
      email: input.user.email.toLowerCase(),
      name: input.user.name,
      role: input.user.role,
      is_admin: input.user.isAdmin,
      // "agency", not "tenant": to an agency's developer a tenant is a renter.
      agency_id: input.user.tenantId,
      return_to: input.returnTo,
      iat: now,
      exp: now + SITE_SIGN_IN_TTL_SECONDS,
      jti: randomUUID(),
    },
    deriveSiteSecret(input.linkId, input.keyId)
  );
}
