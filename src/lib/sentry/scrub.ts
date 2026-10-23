// Strips personal data and secrets from Sentry events before they leave the
// process. Shared by all three runtimes: src/instrumentation-client.ts (browser),
// src/lib/sentry/server.ts (Node) and src/lib/sentry/edge.ts (middleware).
//
// Where personal data would otherwise leak:
//  - Request bodies. Server action payloads carry lead details, passport scans
//    and bank details. Dropped outright.
//  - URLs. Magic links, invite/share/preference tokens and OAuth codes travel in
//    query strings, fragments (Supabase recovery links) and path segments.
//  - Console arguments. captureConsoleIntegration attaches every console.error
//    argument as `extra.arguments`, and plenty of ours log whole objects.
//  - Breadcrumbs: fetch URLs and console lines.
//
// Gmail-imported lead content must stay contained (privacy policy §5), so when
// in doubt this drops rather than keeps. Pure apart from the control-flow
// predicate, so `npm test` runs it without the SDK.
//
//   npm test

import { isNextControlFlow } from "../next-control-flow.ts";

const FILTERED = "[Filtered]";

/** Query/fragment params whose values are credentials or personal data. */
const SENSITIVE_PARAMS = new Set([
  "token",
  "code",
  "state",
  "key",
  "secret",
  "password",
  "email",
  "access_token",
  "refresh_token",
  "id_token",
  "provider_token",
  "sig",
  "signature",
]);

/** Object keys whose values are credentials or personal data, wherever they appear. */
const SENSITIVE_KEY_RE =
  /pass(word|port)|secret|token|api_?key|authori[sz]ation|cookie|e_?mail|phone|mobile|iban|sort_?code|account_?number|date_?of_?birth|^dob$|national_?insurance|ni_?number|post_?code|address|first_?name|last_?name|full_?name/i;

/** Keys whose string values are URLs (breadcrumb `data.url`, navigation `from`/`to`). */
const URL_KEYS = new Set(["url", "from", "to", "href"]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
/**
 * Hex / base64url-ish runs of 32+ characters. Hyphens are excluded on purpose:
 * UUIDs (tenant and record ids) are the most useful thing in an error message
 * and are not secret.
 */
const SECRET_RE = /\b[A-Za-z0-9_]{32,}\b/g;
/** Routes whose next path segment is a bearer token. */
const TOKEN_PATH_RE = /(\/(?:s|f|preferences|api\/shares)\/)[^/?#\s]+/g;

/** Past this depth an object is replaced, not walked. Sentry normalises to 3 anyway. */
const MAX_DEPTH = 8;

export function scrubString(value: string): string {
  return value
    .replace(JWT_RE, "[jwt]")
    .replace(EMAIL_RE, "[email]")
    .replace(TOKEN_PATH_RE, `$1${FILTERED}`)
    .replace(SECRET_RE, (match) =>
      /\d/.test(match) && /[A-Za-z]/.test(match) ? "[secret]" : match
    );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Scrub `a=1&b=2` style params (a query string or a URL fragment). */
function scrubParams(params: string): string {
  return params
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return scrubString(pair);
      const name = pair.slice(0, eq);
      const decodedName = safeDecode(name);
      if (SENSITIVE_PARAMS.has(decodedName.toLowerCase()) || SENSITIVE_KEY_RE.test(decodedName)) {
        return `${name}=${FILTERED}`;
      }
      return `${name}=${scrubString(safeDecode(pair.slice(eq + 1)))}`;
    })
    .join("&");
}

/** Works on absolute and relative URLs alike (breadcrumbs carry both). */
export function scrubUrl(url: string): string {
  const hashAt = url.indexOf("#");
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const fragment = hashAt === -1 ? null : url.slice(hashAt + 1);

  const queryAt = beforeHash.indexOf("?");
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt === -1 ? null : beforeHash.slice(queryAt + 1);

  let out = scrubString(path);
  if (query !== null) out += `?${scrubParams(query)}`;
  if (fragment !== null) out += `#${scrubParams(fragment)}`;
  return out;
}

function scrubDeep(value: unknown, key?: string, depth = 0): unknown {
  if (typeof value === "string") {
    return key !== undefined && URL_KEYS.has(key) ? scrubUrl(value) : scrubString(value);
  }
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH) return FILTERED;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, undefined, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? FILTERED : scrubDeep(v, k, depth + 1);
  }
  return out;
}

// Loose views of the Sentry shapes this touches. The SDK types are not imported
// so the module stays loadable by `npm test`; the generic signatures below still
// line up with `beforeSend` / `beforeBreadcrumb`.
interface LooseBreadcrumb {
  message?: string;
  data?: Record<string, unknown>;
}

interface LooseRequest {
  url?: string;
  query_string?: unknown;
  data?: unknown;
  cookies?: unknown;
  env?: unknown;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

interface LooseEvent {
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  exception?: { values?: { value?: string }[] };
  request?: LooseRequest;
  extra?: Record<string, unknown>;
  breadcrumbs?: LooseBreadcrumb[];
  user?: { id?: string | number; [key: string]: unknown };
  tags?: Record<string, unknown>;
}

function scrubRequest(request: LooseRequest): LooseRequest {
  const headers = request.headers ?? {};
  const userAgent = headers["user-agent"] ?? headers["User-Agent"];
  return {
    ...request,
    url: request.url ? scrubUrl(request.url) : request.url,
    query_string:
      typeof request.query_string === "string" ? scrubParams(request.query_string) : undefined,
    data: undefined,
    cookies: undefined,
    env: undefined,
    headers: userAgent ? { "user-agent": userAgent } : undefined,
  };
}

export function scrubBreadcrumb<B extends object>(breadcrumb: B): B {
  const crumb = breadcrumb as LooseBreadcrumb;
  if (crumb.message) crumb.message = scrubString(crumb.message);
  if (crumb.data) crumb.data = scrubDeep(crumb.data) as Record<string, unknown>;
  return breadcrumb;
}

/**
 * `beforeSend` for every runtime. Returns null to drop the event.
 *
 * Also tags `digest`: Next's id for a server-side failure, which the error pages
 * show users as "Reference". Support can search Sentry for the one a user quotes.
 */
export function scrubEvent<E extends object>(
  event: E,
  hint?: { originalException?: unknown }
): E | null {
  if (isNextControlFlow(hint?.originalException)) return null;

  const e = event as LooseEvent;
  if (e.message) e.message = scrubString(e.message);
  if (e.logentry?.message) e.logentry.message = scrubString(e.logentry.message);
  if (e.logentry?.params) e.logentry.params = scrubDeep(e.logentry.params) as unknown[];
  for (const exception of e.exception?.values ?? []) {
    if (exception.value) exception.value = scrubString(exception.value);
  }
  if (e.request) e.request = scrubRequest(e.request);
  if (e.extra) e.extra = scrubDeep(e.extra) as Record<string, unknown>;
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb);
  // Identify by id only — no email, username or IP, whatever set them.
  if (e.user) e.user = e.user.id !== undefined ? { id: e.user.id } : undefined;

  const digest = (hint?.originalException as { digest?: unknown } | null | undefined)?.digest;
  if (typeof digest === "string") e.tags = { ...e.tags, digest };

  return event;
}
