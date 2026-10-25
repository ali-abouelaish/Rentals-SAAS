import { getUserTenant } from "@/lib/tenant-slug-cache";
import { getPortalDomain, getTenantFromHost } from "@/lib/tenant-host";
import { safeNextPath } from "./safeNext";

/**
 * Where a signed-in user belongs: super admins on /admin, everyone else on their agency's own
 * subdomain — at the deep link they were bounced from, or the dashboard.
 *
 * A same-host path when they're already on the right host (and in development, or when their agency
 * can't be resolved); otherwise an absolute https URL on their subdomain, where the shared
 * .{APP_PORTAL_DOMAIN} session cookie signs them straight in.
 *
 * Used by the sign-in action, by middleware (forwarding signed-in visitors away from /login) and by
 * the homepage's "Open workspace" link, so all three agree. Edge-safe.
 */
export async function resolveWorkspaceUrl({
  userId,
  host,
  next,
}: {
  userId: string;
  host: string | null | undefined;
  next?: unknown;
}): Promise<string> {
  const nextPath = safeNextPath(next);
  const { slug, isSuperAdmin } = await getUserTenant(userId);
  if (isSuperAdmin) return "/admin";

  const portal = getPortalDomain();
  if (process.env.NODE_ENV === "development" || !slug || !portal) return nextPath ?? "/dashboard";
  if (getTenantFromHost(host) === slug) return nextPath ?? "/dashboard";

  // Resolved, not assigned to .pathname: that percent-encoded the "?" of a deep link's query string.
  return new URL(nextPath ?? "/dashboard", `https://${slug}.${portal}`).toString();
}
