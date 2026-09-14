// The single place the app constructs BoldSign API clients. Nothing outside
// src/lib/boldsign/ should import from "boldsign" directly.
//
// Why a factory rather than `new DocumentApi()` at each call site: every
// generated SDK class hard-codes `defaultBasePath = 'https://api.boldsign.com'`
// (US) and accepts the host only through its constructor. One forgotten
// argument would silently send that request — and its document data — outside
// the EU. Routing all construction through createApi() makes that impossible.
//
// The brief called for a `BoldSignService` class; this is a module of
// functions instead, matching the repo's existing integration layer
// (src/lib/dps/apiClient.ts, src/lib/tds/apiClient.ts). It serves the same
// purpose — one chokepoint — without introducing a class-based style the rest
// of the codebase doesn't use.
//
// Server-only: the API key must never reach the browser.

import "server-only";

import {
  BrandingApi,
  DocumentApi,
  SenderIdentitiesApi,
  TemplateApi,
} from "boldsign";

import { boldSignApiKey, boldSignHost } from "./config";

// Re-exported so the rest of the integration keeps a single import site for
// the client layer; the implementation is pure and lives in errors.ts so it
// can be unit-tested without the server-only import above.
import { boldSignErrorMessage } from "./errors";

export { boldSignErrorMessage };

/** The slice of every generated API class that the factory depends on. */
type BoldSignApi = { setApiKey(apiKey: string): void };
type BoldSignApiCtor<T extends BoldSignApi> = new (basePath?: string) => T;

/**
 * Construct an SDK client pinned to the configured host and authenticated with
 * the platform API key (sent as the X-API-KEY header by the SDK).
 *
 * Clients are cheap and hold no connection state, so they are created per call
 * rather than cached — that also means a rotated key takes effect immediately.
 */
function createApi<T extends BoldSignApi>(Api: BoldSignApiCtor<T>): T {
  const api = new Api(boldSignHost());
  api.setApiKey(boldSignApiKey());
  return api;
}

/** Documents: send for signature, read status, download signed PDF + audit trail. */
export function documentApi(): DocumentApi {
  return createApi(DocumentApi);
}

/** Templates: the reusable AST / works order / statement documents (Phase 2). */
export function templateApi(): TemplateApi {
  return createApi(TemplateApi);
}

/** Brands: per-agency logo, colours and legal terms (Phase 5). */
export function brandingApi(): BrandingApi {
  return createApi(BrandingApi);
}

/** Sender identities: send-on-behalf-of a given agency (Phase 5). */
export function senderIdentitiesApi(): SenderIdentitiesApi {
  return createApi(SenderIdentitiesApi);
}

export type BoldSignHealthCheck =
  | { ok: true; host: string; documentCount: number | null }
  | { ok: false; host: string; error: string };

/**
 * Phase 1 acceptance check: prove the key and host authenticate, without
 * writing anything. Lists a single document — the cheapest authenticated read
 * BoldSign exposes. An empty account is a pass: what is being tested is that
 * the request is accepted, not that documents exist.
 */
export async function boldSignHealthCheck(): Promise<BoldSignHealthCheck> {
  const host = boldSignHost();
  try {
    // Positional args, per the OpenAPI-generated signature:
    // listDocuments(page, sentBy, recipients, transmitType, dateFilterType, pageSize, …)
    const records = await documentApi().listDocuments(
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      1
    );
    return {
      ok: true,
      host,
      documentCount: records.pageDetails?.totalRecordsCount ?? null,
    };
  } catch (err) {
    return { ok: false, host, error: boldSignErrorMessage(err) };
  }
}
