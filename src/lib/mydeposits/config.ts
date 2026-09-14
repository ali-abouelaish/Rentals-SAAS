// Single source of truth for every mydeposits (Total Property) endpoint detail.
//
// Their docs give endpoint *paths* but not request/response schemas. The
// hosts and service prefixes below are verified live against the sandbox
// (2026-08-20) — see MD_SERVICE. If any prove wrong, fix them HERE; nothing
// else in the integration hardcodes a URL or version.

export type MdEnvironment = "sandbox" | "production";

type MdEnvUrls = { apiBase: string; authBase: string };

// authBase verified via OIDC discovery (GET {authBase}/.well-known/openid-configuration):
// authorization_endpoint and token_endpoint both live on auth.{env}.totalproperty.co.uk.
// Note: authapi.{env}.totalproperty.co.uk/totalpropertyauth is the *headless* Auth API
// (email/SMS login endpoints) — it serves no browser UI, so do NOT send users there.
const ENV_URLS: Record<MdEnvironment, MdEnvUrls> = {
  sandbox: {
    apiBase: "https://api.sandbox.totalproperty.co.uk/totalproperty",
    authBase: "https://auth.sandbox.totalproperty.co.uk",
  },
  production: {
    apiBase: "https://api.totalproperty.co.uk/totalproperty",
    authBase: "https://auth.totalproperty.co.uk",
  },
};

/** API version segment substituted into service paths ({version} placeholder). */
export const MD_API_VERSION = "v1";

/**
 * Service path prefixes (Total Property names its services after Infinity
 * Stones). Combined with MD_API_VERSION these yield `/rs/api/v1/...` etc.
 *   - RealityStone: properties, tenancies, deposits, payments, certificates
 *   - TimeStone:    release requests + settlements
 *   - SpaceStone:   reference-data lookups
 *
 * Verified live against sandbox with a real bearer token (2026-08-20):
 *   {apiBase}/rs/api/v1/deposits|properties|tenancies -> 200
 *   {apiBase}/ts/api/v1/release-requests              -> 200
 * The `/api` segment is required — `/rs/v1/...` 404s. SpaceStone resource
 * names are still unconfirmed (the prefix follows the same shape).
 */
export const MD_SERVICE = {
  realityStone: "/rs/api",
  timeStone: "/ts/api",
  spaceStone: "/sps/api",
} as const;

export function resolveMdEnvironment(): MdEnvironment {
  return process.env.MYDEPOSITS_ENV === "production" ? "production" : "sandbox";
}

/**
 * Which auth flow to drive when an admin connects mydeposits:
 *   - "browser"  (default): authorization-code redirect via /connect/authorize (./oauth.ts).
 *   - "headless": email/SMS "Login" (Consumer) flow via /api/v1/ui/* (./headlessAuth.ts),
 *     the fallback while the browser authorize endpoint dead-ends on a blank page.
 */
export type MdAuthMode = "browser" | "headless";
export function resolveMdAuthMode(): MdAuthMode {
  return process.env.MYDEPOSITS_AUTH_MODE === "headless" ? "headless" : "browser";
}

export function mdUrls(env: MdEnvironment = resolveMdEnvironment()): MdEnvUrls {
  return ENV_URLS[env];
}

export function mdOAuthConfig() {
  const clientId = process.env.MYDEPOSITS_CLIENT_ID;
  const clientSecret = process.env.MYDEPOSITS_CLIENT_SECRET;
  const redirectUri = process.env.MYDEPOSITS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing mydeposits OAuth env vars: MYDEPOSITS_CLIENT_ID, MYDEPOSITS_CLIENT_SECRET, MYDEPOSITS_REDIRECT_URI"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** Public portal base for deep-linking disputes/resolution (handled in-portal). */
export const MD_PORTAL_URL = "https://www.mydeposits.co.uk";
