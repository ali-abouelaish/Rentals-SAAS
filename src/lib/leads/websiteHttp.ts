import { NextResponse } from "next/server";
import { pairsFromFormData, pairsFromJson, type Pair } from "@/features/leads/domain/websiteLead";

/**
 * HTTP plumbing for POST /api/public/leads: reading and parsing the body, and
 * answering in JSON (servers, plugins, automation tools) or in HTML (a plain
 * <form action> post, where the response is what the visitor's browser
 * shows). Kept out of route.ts, which may only export handlers.
 */

export const MAX_BODY_BYTES = 64 * 1024;

const CORS = { "Access-Control-Allow-Origin": "*" };
const NO_STORE = { "Cache-Control": "no-store" };

export const PREFLIGHT_HEADERS = {
  ...CORS,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
  "Access-Control-Max-Age": "86400",
};

const FORM_TYPES = new Set(["application/x-www-form-urlencoded", "multipart/form-data"]);

function mimeOf(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * Whether the request is a browser submitting a plain HTML form, i.e. the
 * visitor will see whatever we send back. Decided from headers alone, so even
 * auth and rate-limit errors can be shown as a page rather than raw JSON.
 */
export function isBrowserNavigation(request: Request): boolean {
  if (!FORM_TYPES.has(mimeOf(request.headers.get("content-type")))) return false;
  const mode = request.headers.get("sec-fetch-mode");
  if (mode) return mode === "navigate";
  return (request.headers.get("accept") ?? "").includes("text/html");
}

/** Content-Length says the body is over the cap. */
export function declaresTooLarge(request: Request): boolean {
  const declared = Number(request.headers.get("content-length") ?? "");
  return Number.isFinite(declared) && declared > MAX_BODY_BYTES;
}

/**
 * The raw body, or null once it passes the cap. Streamed, because a chunked
 * upload has no Content-Length to check up front.
 */
export async function readBodyWithLimit(request: Request): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export type BodyParseResult =
  | { ok: true; pairs: Pair[]; filesIgnored: number }
  | { ok: false; status: 400 | 415; error: "invalid_body" | "unsupported_media_type"; message: string };

const UNSUPPORTED =
  "Send JSON (application/json) or form data (application/x-www-form-urlencoded or multipart/form-data).";

/** JSON, plain text holding JSON (sendBeacon), urlencoded or multipart. */
export async function parseBodyToPairs(
  body: Uint8Array<ArrayBuffer>,
  contentType: string | null
): Promise<BodyParseResult> {
  const mime = mimeOf(contentType);
  if (body.byteLength === 0) {
    return { ok: false, status: 400, error: "invalid_body", message: "The request body is empty." };
  }

  if (FORM_TYPES.has(mime)) {
    try {
      // Re-wrap the capped bytes so the platform's form parser does the work
      // (multipart boundaries included) without reading the request twice.
      const form = await new Response(body, { headers: { "content-type": contentType ?? mime } }).formData();
      const parsed = pairsFromFormData(form);
      if ("error" in parsed) return { ok: false, status: 400, error: "invalid_body", message: parsed.error };
      return { ok: true, pairs: parsed.pairs, filesIgnored: parsed.filesIgnored };
    } catch {
      return { ok: false, status: 400, error: "invalid_body", message: "The form data could not be read." };
    }
  }

  const declaredJson = mime === "application/json" || mime.endsWith("+json");
  if (declaredJson || mime === "text/plain" || mime === "") {
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return declaredJson
        ? { ok: false, status: 400, error: "invalid_body", message: "The body is not valid JSON." }
        : { ok: false, status: 415, error: "unsupported_media_type", message: UNSUPPORTED };
    }
    const parsed = pairsFromJson(json);
    if ("error" in parsed) return { ok: false, status: 400, error: "invalid_body", message: parsed.error };
    return { ok: true, pairs: parsed.pairs, filesIgnored: 0 };
  }

  return { ok: false, status: 415, error: "unsupported_media_type", message: UNSUPPORTED };
}

function requestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") return origin;
  return httpOrigin(request.headers.get("referer"));
}

function httpOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/**
 * Where to send the visitor after a form post. Only a page on the same
 * website the form was posted from — otherwise anyone could use Harbor as an
 * open redirect.
 */
export function safeRedirectTarget(request: Request, target: string | null): string | null {
  if (!target) return null;
  const origin = requestOrigin(request);
  if (!origin) return null;
  try {
    const url = new URL(target, origin);
    return url.origin === origin ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The page the visitor came from, for a "go back" link (http(s) only). */
function backLink(request: Request): string | null {
  const referer = request.headers.get("referer");
  return referer && httpOrigin(referer) ? referer : null;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type LeadOutcome =
  | { kind: "created"; id: string; warnings: string[]; redirect: string | null }
  | { kind: "duplicate"; id: string; redirect: string | null }
  | { kind: "test"; lead: Record<string, unknown>; warnings: string[]; redirect: string | null }
  | { kind: "ignored"; redirect: string | null }
  | {
      kind: "error";
      status: number;
      error: string;
      message: string;
      fields?: Record<string, string>;
      retryAfter?: number;
    };

export function jsonFor(outcome: LeadOutcome): NextResponse {
  const headers: Record<string, string> = { ...CORS, ...NO_STORE };
  switch (outcome.kind) {
    case "created":
      return NextResponse.json(
        {
          status: "created",
          id: outcome.id,
          ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}),
        },
        { status: 201, headers }
      );
    case "duplicate":
      return NextResponse.json({ status: "duplicate", id: outcome.id }, { status: 200, headers });
    case "test":
      return NextResponse.json(
        {
          status: "valid",
          test: true,
          lead: outcome.lead,
          ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}),
        },
        { status: 200, headers }
      );
    case "ignored":
      return NextResponse.json({ status: "ignored" }, { status: 200, headers });
    case "error":
      if (outcome.retryAfter) headers["Retry-After"] = String(outcome.retryAfter);
      return NextResponse.json(
        {
          error: outcome.error,
          message: outcome.message,
          ...(outcome.fields ? { fields: outcome.fields } : {}),
          ...(outcome.retryAfter ? { retry_after: outcome.retryAfter } : {}),
        },
        { status: outcome.status, headers }
      );
  }
}

/** For a plain HTML form post: redirect back to the site, or show a small page. */
export function htmlFor(request: Request, outcome: LeadOutcome): Response {
  if (outcome.kind === "created" || outcome.kind === "duplicate" || outcome.kind === "ignored") {
    // A filled honeypot gets exactly what a real visitor gets, so a bot learns nothing.
    const target = safeRedirectTarget(request, outcome.redirect);
    if (target) return new Response(null, { status: 303, headers: { Location: target, ...CORS, ...NO_STORE } });
    return page(200, "Thank you", "Your enquiry has been sent. The agency will be in touch soon.", [], backLink(request));
  }
  if (outcome.kind === "test") {
    return page(
      200,
      "Test received",
      "The form is connected and the enquiry was read correctly. Test mode is on, so nothing was saved.",
      [],
      backLink(request)
    );
  }
  const details = Object.entries(outcome.fields ?? {}).map(([field, problem]) => `${field}: ${problem}`);
  return page(outcome.status, "Your enquiry wasn't sent", outcome.message, details, backLink(request), outcome.retryAfter);
}

const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'";

const PAGE_STYLE =
  "body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f5f6f8;color:#16181d;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}" +
  "main{background:#fff;border:1px solid #e2e4e9;border-radius:12px;max-width:460px;width:100%;padding:28px;box-sizing:border-box}" +
  "h1{font-size:20px;margin:0 0 8px}p,li{line-height:1.5;color:#3a3f4a}p{margin:0 0 12px}ul{margin:0 0 12px;padding-left:18px}a{color:#0b5cc4}" +
  "@media (prefers-color-scheme:dark){body{background:#101114;color:#eceef2}main{background:#1a1c21;border-color:#2e3139}p,li{color:#c4c8d0}a{color:#7fb0ff}}";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(
  status: number,
  title: string,
  message: string,
  details: string[],
  back: string | null,
  retryAfter?: number
): Response {
  const list = details.length ? `<ul>${details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>` : "";
  const link = back ? `<p><a href="${escapeHtml(back)}">Go back</a></p>` : "";
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">` +
    `<title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head>` +
    `<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${list}${link}</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": PAGE_CSP,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      ...CORS,
      ...NO_STORE,
    },
  });
}
