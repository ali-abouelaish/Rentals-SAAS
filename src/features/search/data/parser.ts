const MAX_QUERY_LENGTH = 200;

/**
 * Convert raw user input into a Postgres tsquery string with prefix
 * matching on every term, e.g. "Albert Road" → "albert:* & road:*".
 *
 * Returns null when there's nothing valid to query — caller should
 * skip the SQL round-trip in that case.
 */
export function parseSearchQuery(raw: string): string | null {
  if (!raw) return null;
  const truncated = raw.slice(0, MAX_QUERY_LENGTH);
  const terms = truncated
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter((term) => term.length > 0);

  if (terms.length === 0) return null;
  return terms.map((term) => `${term}:*`).join(" & ");
}
