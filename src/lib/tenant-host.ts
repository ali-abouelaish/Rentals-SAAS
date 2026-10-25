/**
 * Host name → agency slug. Pure, with no Node or Next imports, so middleware (Edge) and server code
 * share one copy.
 *
 * Examples (portal domain = harborops.co.uk):
 * - "truehold.harborops.co.uk" -> "truehold"
 * - "www.harborops.co.uk"      -> null
 * - "harborops.co.uk"          -> null
 * - "localhost"                -> null
 */

/** APP_PORTAL_DOMAIN without scheme or trailing slash, lower-cased — or null when unset. */
export function getPortalDomain(): string | null {
  const raw = process.env.APP_PORTAL_DOMAIN;
  if (!raw) return null;
  const portal = raw.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  return portal || null;
}

export function getTenantFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();

  // Portal domain: everything that's exactly this host (or its www.) is apex.
  const portal = getPortalDomain();
  if (portal) {
    if (hostname === portal || hostname === `www.${portal}`) return null;
    if (hostname.endsWith(`.${portal}`)) {
      const sub = hostname.slice(0, -1 - portal.length);
      if (!sub || sub === "www") return null;
      // Only the leftmost label is the tenant slug.
      return sub.split(".")[0] || null;
    }
    // Host isn't under the portal domain (local dev, preview URLs, IPs) — treat as apex.
    return null;
  }

  // Fallback heuristic when APP_PORTAL_DOMAIN isn't set:
  // treat anything with 3+ labels (excluding leading www) as a subdomain.
  const parts = hostname.split(".");
  if (parts.length > 2) {
    const [first] = parts;
    if (first && first !== "www") return first;
  }
  return null;
}
