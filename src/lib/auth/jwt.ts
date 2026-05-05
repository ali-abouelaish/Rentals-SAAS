import { cookies } from "next/headers";

export interface DecodedAccessTokenUser {
  id: string;
  email?: string;
  exp: number;
}

const SUPABASE_REF = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .replace(/^https?:\/\//, "")
  .split(".")[0];

const COOKIE_NAME = SUPABASE_REF ? `sb-${SUPABASE_REF}-auth-token` : "";

function readSessionCookieValue(): string | null {
  if (!COOKIE_NAME) return null;
  const store = cookies();

  // @supabase/ssr splits large session payloads across .0, .1, ... chunks.
  const chunks = store
    .getAll()
    .filter((c) => c.name === COOKIE_NAME || c.name.startsWith(`${COOKIE_NAME}.`))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value);

  if (chunks.length === 0) return null;
  let raw = chunks.join("");

  // Newer @supabase/ssr versions prefix the JSON payload with `base64-`.
  if (raw.startsWith("base64-")) {
    try {
      raw = Buffer.from(raw.slice("base64-".length), "base64").toString("utf-8");
    } catch {
      return null;
    }
  }
  return raw;
}

function extractAccessToken(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.access_token === "string") return parsed.access_token;
    // Some versions store an array: [access_token, refresh_token, ...]
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {
    // not JSON
  }
  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Read the Supabase access token from the request cookie and decode it locally
 * — without calling supabase.auth.getSession()/getUser(). This avoids triggering
 * a refresh-token rotation in server-component / server-action code paths,
 * which is the root cause of "random logouts" when multiple parallel reads
 * race to refresh the same near-expiry token.
 *
 * Refresh stays the responsibility of middleware (the only writer that can
 * persist rotated tokens to the response).
 *
 * Returns null when the cookie is missing, malformed, or already expired —
 * caller should treat that as "not authenticated" and redirect to /login.
 * Trust model matches the existing getSession() path (no signature check);
 * RLS continues to enforce real security at the DB layer.
 */
export function getUserFromAccessTokenCookie(): DecodedAccessTokenUser | null {
  const raw = readSessionCookieValue();
  if (!raw) return null;

  const token = extractAccessToken(raw);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const sub = payload["sub"];
  const exp = payload["exp"];
  if (typeof sub !== "string" || typeof exp !== "number") return null;
  if (exp * 1000 <= Date.now()) return null;

  const email = typeof payload["email"] === "string" ? (payload["email"] as string) : undefined;
  return { id: sub, email, exp };
}
