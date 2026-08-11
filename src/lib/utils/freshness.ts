/**
 * Listing freshness.
 *
 * Scraped listings carry no reliable liveness signal of their own — `status` is
 * hardcoded 'available' on every scraped row — so age is the only honest measure
 * of whether a listing is still real. Both write paths stamp when they last
 * confirmed a listing at its source (`scraped_listings.last_seen_at`) and when
 * they last read a landlord end-to-end (`landlords.last_scraped_at`); these
 * helpers turn those into something a user or an API consumer can act on.
 */

/**
 * Past this, treat a listing as unverified rather than available. The scraper and
 * the spreadsheet importer both run daily, so anything beyond a week has missed
 * six consecutive reads — that is a broken source, not a slow one.
 */
export const STALE_AFTER_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days since `value`, or null if never recorded. Null is deliberately not
 * folded into a number: "never read" and "read today" must not be confusable,
 * and callers should decide which way to treat the unknown.
 */
export function ageInDays(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  const ms = date.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((Date.now() - ms) / MS_PER_DAY);
}

/**
 * Unknown age counts as stale. A row with no timestamp predates freshness
 * tracking, which makes it old by definition — the opposite default would let
 * exactly the oldest rows present themselves as fresh.
 */
export function isStale(
  value: string | Date | null | undefined,
  thresholdDays: number = STALE_AFTER_DAYS
): boolean {
  const age = ageInDays(value);
  return age === null || age > thresholdDays;
}

/** Compact relative age for display: "Never", "Today", "3 days ago", "4 months ago". */
export function formatAge(value: string | Date | null | undefined): string {
  const days = ageInDays(value);
  if (days === null) return "Never";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
