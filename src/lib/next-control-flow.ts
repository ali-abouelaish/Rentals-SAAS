/**
 * True for the errors Next throws to implement `redirect()` and `notFound()`.
 *
 * They are control flow, not failures: anything that catches broadly has to let
 * them through (see `rethrowIfNextControlFlow`), and error reporting has to drop
 * them (see src/lib/sentry/scrub.ts). Import-free so both server and client
 * bundles, and `npm test`, can load it.
 */
export function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_REDIRECT"))
  );
}
