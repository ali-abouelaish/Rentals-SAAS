/**
 * Derive the tenant slug from a host name.
 *
 * Examples:
 * - "truehold.harborops.co.uk" -> "truehold"
 * - "www.harborops.co.uk"      -> null
 * - "harborops.co.uk"          -> null
 */
export function getTenantFromHost(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  const parts = hostname.split(".");

  if (parts.length > 2) {
    const [first] = parts;
    if (first && first !== "www") {
      return first;
    }
  }

  return null;
}

