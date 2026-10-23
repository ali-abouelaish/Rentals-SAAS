import type { SupabaseClient } from "@supabase/supabase-js";

type ListingHints = {
  /** An explicit scraped_listings id (website enquiries built from the listings API). */
  listingId?: string | null;
  propertyRef?: string | null;
  propertyUrl?: string | null;
};

/** Hints shorter than this match far too much to be worth trying. */
const MIN_HINT_LENGTH = 3;

/**
 * Link a lead to one of the tenant's listings (scraped_listings).
 *
 * An explicit listing id is honoured only if it belongs to the tenant — the id
 * may come from a public request, and must never link across tenants. It
 * falls back to fuzzy matching: the property ref against listing titles, then
 * the property URL against listing URLs. A fuzzy match links only when
 * exactly one listing matches, because a guess between two rooms is worse
 * than no link.
 *
 * `explicitRejected` reports an explicit id that didn't belong to the tenant
 * (or didn't exist), so the caller can warn about it.
 */
export async function matchListingForLead(
  admin: SupabaseClient,
  tenantId: string,
  hints: ListingHints
): Promise<{ listingId: string | null; explicitRejected: boolean }> {
  let explicitRejected = false;

  if (hints.listingId) {
    const { data } = await admin
      .from("scraped_listings")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", hints.listingId)
      .maybeSingle();
    if (data?.id) return { listingId: data.id as string, explicitRejected: false };
    explicitRejected = true;
  }

  const byRef = await uniqueMatch(admin, tenantId, "title", hints.propertyRef);
  if (byRef) return { listingId: byRef, explicitRejected };

  const byUrl = await uniqueMatch(admin, tenantId, "url", hints.propertyUrl);
  return { listingId: byUrl, explicitRejected };
}

async function uniqueMatch(
  admin: SupabaseClient,
  tenantId: string,
  column: "title" | "url",
  hint: string | null | undefined
): Promise<string | null> {
  // "*" is PostgREST's alias for "%" in like patterns and can't be escaped,
  // so it is dropped; "%", "_" and "\" are escaped so they match literally.
  const term = (hint ?? "").replace(/\*/g, "").trim();
  if (term.length < MIN_HINT_LENGTH) return null;

  const { data } = await admin
    .from("scraped_listings")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike(column, `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    .limit(2);

  return data && data.length === 1 ? (data[0].id as string) : null;
}
