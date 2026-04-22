/**
 * Returns the shared cookie domain (leading dot) that makes Supabase session
 * cookies readable across every tenant subdomain — e.g. ".harborops.co.uk".
 *
 * Without this, a user who signs in on the apex (harborops.co.uk) lands on a
 * tenant subdomain with no visible session cookie and gets bounced to /login.
 *
 * Returns undefined in development or when APP_PORTAL_DOMAIN is unset, so
 * localhost cookies stay host-scoped (the browser rejects Domain= for hosts
 * that don't match anyway).
 */
export function getSharedCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  const raw = process.env.APP_PORTAL_DOMAIN;
  if (!raw) return undefined;

  const normalized = raw
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  if (!normalized || !normalized.includes(".")) return undefined;

  return `.${normalized}`;
}
