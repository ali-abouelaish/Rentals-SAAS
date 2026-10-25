/**
 * The post-login destination (`next`), reduced to a path on our own site — or null.
 *
 * `next` arrives in the query string, so it is hostile input. A naive "starts with a single slash"
 * check is not enough: `/%09/evil.example` decodes to "/\t/evil.example", which passes it, and then
 * every URL parser (browsers included) strips the tab and reads `//evil.example` — another host.
 * So: refuse ASCII control characters, spaces and backslashes outright, resolve what's left against
 * a placeholder origin, and insist the origin didn't change. Only the path, query and hash survive.
 *
 * Pure, with no Node or Next imports: middleware (Edge) uses it too.
 */
const PLACEHOLDER_ORIGIN = "https://next.invalid";
const MAX_LENGTH = 2048;

export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.length > MAX_LENGTH) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f\\]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
