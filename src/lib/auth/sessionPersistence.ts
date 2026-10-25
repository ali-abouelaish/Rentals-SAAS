/**
 * "Keep me signed in on this device", unticked: the session ends when the browser is closed.
 *
 * @supabase/ssr writes its auth cookies with a fixed 400-day Max-Age (it overrides any cookieOptions
 * maxAge on every write), so the Supabase cookies can't simply be made session cookies. Two small
 * markers do it instead, both holding the session's own id (the access token's `session_id` claim):
 *
 *   ho_session_only = <session id>   persistent: "this session was not to be kept"
 *   ho_sess         = <session id>   browser-session cookie: "…and the browser hasn't closed since"
 *
 * When the first matches the current session but the second doesn't, the browser has been restarted,
 * and middleware signs the request out. Keying on the session id means a session created any other
 * way (a password-reset or invite link, a later "keep me signed in" login) is never caught by an old
 * choice, so the marker can stay where it is. Copies of the old session's cookies left on another
 * subdomain are caught when that subdomain is next visited.
 *
 * Known limit: browsers that restore the previous session also restore its session cookies, as they
 * do for every site.
 *
 * Pure, with no Node or Next imports: middleware (Edge) uses it.
 */

export const SESSION_ONLY_COOKIE = "ho_session_only";
export const SESSION_ALIVE_COOKIE = "ho_sess";

const SUPABASE_REF = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .replace(/^https?:\/\//, "")
  .split(".")[0];

/** sb-<ref>-auth-token — the same name src/lib/auth/jwt.ts reads. */
export const AUTH_TOKEN_COOKIE = SUPABASE_REF ? `sb-${SUPABASE_REF}-auth-token` : "";

const CHUNK = /^\.(\d+)$/;

/**
 * The session-token cookie and its `.0`, `.1`… chunks. Never `…-code-verifier`: that one carries the
 * PKCE verifier a password-reset or invite link needs, and deleting it breaks /auth/callback.
 */
export function isSessionTokenCookie(name: string): boolean {
  if (!AUTH_TOKEN_COOKIE || !name.startsWith(AUTH_TOKEN_COOKIE)) return false;
  const rest = name.slice(AUTH_TOKEN_COOKIE.length);
  return rest === "" || CHUNK.test(rest);
}

type CookieLike = { name: string; value: string };

function chunkIndex(name: string): number {
  const match = CHUNK.exec(name.slice(AUTH_TOKEN_COOKIE.length));
  return match ? Number(match[1]) : -1;
}

function decodeBase64(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** The `session_id` claim of an access token, read without verifying it (only used to match markers). */
export function sessionIdFromAccessToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const json = decodeBase64(parts[1]);
  if (!json) return null;
  try {
    const payload = JSON.parse(json) as Record<string, unknown>;
    const sid = payload["session_id"];
    return typeof sid === "string" && sid ? sid : null;
  } catch {
    return null;
  }
}

/** The current session's id, from the (possibly chunked, possibly base64-) Supabase session cookie. */
export function sessionIdFromCookies(cookies: CookieLike[]): string | null {
  const chunks = cookies
    .filter((c) => isSessionTokenCookie(c.name))
    .sort((a, b) => chunkIndex(a.name) - chunkIndex(b.name))
    .map((c) => c.value);
  if (chunks.length === 0) return null;

  let raw = chunks.join("");
  // Newer @supabase/ssr versions prefix the JSON payload with `base64-`.
  if (raw.startsWith("base64-")) {
    const decoded = decodeBase64(raw.slice("base64-".length));
    if (decoded === null) return null;
    raw = decoded;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const token = (parsed as Record<string, unknown>)["access_token"];
      return sessionIdFromAccessToken(typeof token === "string" ? token : null);
    }
    // Some versions store an array: [access_token, refresh_token, ...]
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return sessionIdFromAccessToken(parsed[0]);
  } catch {
    // not JSON
  }
  return null;
}

/**
 * True when the current session was signed in with "Keep me signed in" unticked and the browser has
 * been closed since. The caller then treats the request as signed out.
 */
export function isSessionOnlyExpired(cookies: CookieLike[]): boolean {
  const marker = cookies.find((c) => c.name === SESSION_ONLY_COOKIE)?.value;
  if (!marker) return false;
  const sessionId = sessionIdFromCookies(cookies);
  if (!sessionId || sessionId !== marker) return false;
  return cookies.find((c) => c.name === SESSION_ALIVE_COOKIE)?.value !== sessionId;
}

export type MarkerCookie = {
  name: string;
  value: string;
  options: {
    domain?: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    maxAge?: number;
  };
};

const MARKER_MAX_AGE = 400 * 24 * 60 * 60; // as long as the Supabase cookies it shadows

/**
 * The marker cookies to write at sign-in. Ticked (or no readable session id): clear both, so the
 * session is kept as before. Unticked: mark this session as browser-session only.
 */
export function sessionPersistenceCookies({
  keepSignedIn,
  sessionId,
  domain,
  secure,
}: {
  keepSignedIn: boolean;
  sessionId: string | null;
  domain: string | undefined;
  secure: boolean;
}): MarkerCookie[] {
  const base = { domain, path: "/", httpOnly: true, secure, sameSite: "lax" as const };
  if (keepSignedIn || !sessionId) {
    return [
      { name: SESSION_ONLY_COOKIE, value: "", options: { ...base, maxAge: 0 } },
      { name: SESSION_ALIVE_COOKIE, value: "", options: { ...base, maxAge: 0 } },
    ];
  }
  return [
    { name: SESSION_ONLY_COOKIE, value: sessionId, options: { ...base, maxAge: MARKER_MAX_AGE } },
    // no maxAge: a browser-session cookie, gone when the browser closes
    { name: SESSION_ALIVE_COOKIE, value: sessionId, options: base },
  ];
}

/**
 * Raw Set-Cookie values that delete a cookie in both places it can live: on the shared parent domain
 * (where server code writes the Supabase cookies) and host-only (where the browser client writes its
 * copies). Raw, because NextResponse.cookies is keyed by name and can hold only one of the two.
 */
export function deletionHeaders(name: string, sharedDomain: string | undefined, secure: boolean): string[] {
  const tail = `Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure ? "; Secure" : ""}`;
  const headers = [`${name}=; ${tail}`];
  if (sharedDomain) headers.push(`${name}=; Domain=${sharedDomain}; ${tail}`);
  return headers;
}
