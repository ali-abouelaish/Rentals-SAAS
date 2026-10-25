import "server-only";

import { getTenantBrandingByHost } from "@/lib/tenant";
import { getPortalDomain } from "@/lib/tenant-host";

export type DoorContext = {
  /** The agency whose subdomain this is ("Sign in to …"), or null on the bare domain. */
  brandName: string | null;
  /** "Back to site": the public website, which lives on the bare domain. */
  siteHref: string;
};

/**
 * What the sign-in screens need to know about the host. On an agency's own subdomain the door
 * names the agency, and its site links point at the public website on the bare domain (that
 * subdomain's own root just leads back to sign-in).
 */
export async function getDoorContext(): Promise<DoorContext> {
  const branding = await getTenantBrandingByHost();
  if (!branding) return { brandName: null, siteHref: "/" };
  const portal = getPortalDomain();
  return { brandName: branding.brandName, siteHref: portal ? `https://${portal}/` : "/" };
}
