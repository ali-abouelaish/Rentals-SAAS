/**
 * Sanitize a free-text search term before embedding it in a PostgREST filter
 * string (e.g. `query.or("name.ilike.%<term>%,...")`).
 *
 * Commas separate OR conditions, parentheses group them, and a backslash can
 * escape the next character — so an unsanitized term could inject additional
 * filter conditions into the query. Row-Level Security still scopes every such
 * query to the caller's tenant (and, where applicable, their own rows), so this
 * is defense-in-depth rather than the primary control; it also prevents
 * malformed-input query errors. We drop the structural characters and collapse
 * the run of whitespace they leave behind.
 */
export function sanitizeFilterTerm(term: string): string {
  return term.replace(/[,()\\]/g, " ").replace(/\s+/g, " ").trim();
}
