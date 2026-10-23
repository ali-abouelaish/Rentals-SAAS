/**
 * Every scope a public API key can carry. The DB constraint
 * `public_api_keys_scopes_known` mirrors this list — add a new scope in both.
 */
export const API_SCOPES = ["scraped_listings:read", "leads:write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const LISTINGS_READ_SCOPE: ApiScope = "scraped_listings:read";
export const LEADS_WRITE_SCOPE: ApiScope = "leads:write";

export const SCOPE_META: Record<ApiScope, { label: string; description: string }> = {
  "scraped_listings:read": {
    label: "Read listings",
    description: "GET /api/public/scraped-listings",
  },
  "leads:write": {
    label: "Send website leads",
    description: "POST /api/public/leads — can add enquiries, can't read anything",
  },
};

export function scopeLabel(scope: string): string {
  return (SCOPE_META as Record<string, { label: string } | undefined>)[scope]?.label ?? scope;
}

/**
 * Whether a key may travel in a URL (`?key=`). URLs end up in access logs,
 * browser history and page source, so only a key that can do nothing but add
 * leads qualifies: if it leaks, the worst case is junk enquiries until it is
 * revoked. Anything that can read data must be sent in a header.
 */
export function isUrlSafeScopeSet(scopes: readonly string[]): boolean {
  return scopes.length === 1 && scopes[0] === LEADS_WRITE_SCOPE;
}
