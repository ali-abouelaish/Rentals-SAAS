import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiKeyFromHeaders, verifyApiKeyValue } from "@/lib/api-keys/verify";
import { LEADS_WRITE_SCOPE, isUrlSafeScopeSet } from "@/lib/api-keys/scopes";
import { isFeatureEnabledForTenant } from "@/lib/entitlements/tenantFeature";
import { clientIpFromHeaders, rateLimitCheck } from "@/features/property-shares/lib/rate-limit";
import { IngestError, ingestWebsiteLead } from "@/lib/leads/ingestWebsiteLead";
import {
  PREFLIGHT_HEADERS,
  declaresTooLarge,
  htmlFor,
  isBrowserNavigation,
  jsonFor,
  parseBodyToPairs,
  readBodyWithLimit,
  type LeadOutcome,
} from "@/lib/leads/websiteHttp";

/**
 * POST /api/public/leads — an agency's website sends one enquiry; it becomes
 * a lead (source "website") on that agency's Leads page.
 *
 * The API key is the only thing that decides the agency. It may come in a
 * header (Authorization: Bearer / x-api-key) or, for form plugins that can't
 * set headers, as ?key= — but only a key that can do nothing except add leads
 * is accepted in a URL. Developer spec: docs/website-leads-api.md.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generous for any real website; the daily cap is what limits a leaked key. */
const PER_KEY_PER_MINUTE = 60;
const PER_KEY_PER_DAY = 1000;
/** Only bites on direct browser posts — server calls all share one IP. */
const PER_KEY_AND_IP_PER_MINUTE = 10;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PREFLIGHT_HEADERS });
}

export async function POST(request: NextRequest) {
  const browser = isBrowserNavigation(request);
  const reply = (outcome: LeadOutcome) => (browser ? htmlFor(request, outcome) : jsonFor(outcome));
  const fail = (
    status: number,
    error: string,
    message: string,
    extra: { fields?: Record<string, string>; retryAfter?: number } = {}
  ) => reply({ kind: "error", status, error, message, ...extra });

  if (declaresTooLarge(request)) {
    return fail(413, "payload_too_large", "The enquiry is too large (64 KB max). File uploads aren't supported.");
  }

  const headerKey = apiKeyFromHeaders(request.headers);
  const urlKey = headerKey ? null : request.nextUrl.searchParams.get("key");
  const rawKey = headerKey ?? urlKey;
  if (!rawKey) {
    return fail(401, "unauthorized", "Missing API key. Send it as Authorization: Bearer <key>, an x-api-key header, or ?key= on the URL.");
  }

  const key = await verifyApiKeyValue(rawKey);
  if (!key) return fail(401, "unauthorized", "Invalid or revoked API key.");

  if (urlKey && !isUrlSafeScopeSet(key.scopes)) {
    return fail(
      403,
      "key_not_allowed_in_url",
      "This key can read data, so it must not be put in a URL — it may now be exposed in logs. Revoke it, and connect the website from Leads → Settings to get a key that can only add leads."
    );
  }
  if (!key.scopes.includes(LEADS_WRITE_SCOPE)) {
    return fail(403, "insufficient_scope", "This key can't send leads. Use a website key from Leads → Settings.");
  }

  const ip = clientIpFromHeaders(request);
  const limits = [
    rateLimitCheck(`leads:ip:${key.id}:${ip}`, MINUTE_MS, PER_KEY_AND_IP_PER_MINUTE),
    rateLimitCheck(`leads:key:${key.id}`, MINUTE_MS, PER_KEY_PER_MINUTE),
    rateLimitCheck(`leads:day:${key.id}`, DAY_MS, PER_KEY_PER_DAY),
  ];
  const blocked = limits.filter((l) => !l.allowed);
  if (blocked.length > 0) {
    const retryAfter = Math.max(1, ...blocked.map((l) => l.retryAfterSec));
    return fail(429, "rate_limited", "Too many enquiries from this website. Please try again shortly.", { retryAfter });
  }

  try {
    const [tenantStatus, leadsOn, websiteLeadsOn] = await Promise.all([
      getTenantStatus(key.tenant_id),
      isFeatureEnabledForTenant(key.tenant_id, "leads"),
      isFeatureEnabledForTenant(key.tenant_id, "website_leads"),
    ]);
    if (tenantStatus !== "active") {
      return fail(403, "account_inactive", "This agency's Harbor Ops account isn't active.");
    }
    if (!leadsOn || !websiteLeadsOn) {
      return fail(403, "feature_disabled", "Website lead capture is switched off for this agency.");
    }
  } catch (err) {
    console.error("[public/leads] tenant check failed", err instanceof Error ? err.name : "unknown");
    return fail(500, "server_error", "Something went wrong on our side. Please try again.");
  }

  const body = await readBodyWithLimit(request);
  if (!body) {
    return fail(413, "payload_too_large", "The enquiry is too large (64 KB max). File uploads aren't supported.");
  }
  const parsed = await parseBodyToPairs(body, request.headers.get("content-type"));
  if (!parsed.ok) return fail(parsed.status, parsed.error, parsed.message);

  try {
    const outcome = await ingestWebsiteLead({
      tenantId: key.tenant_id,
      apiKeyId: key.id,
      pairs: parsed.pairs,
      filesIgnored: parsed.filesIgnored,
    });
    if (outcome.kind === "invalid") {
      return fail(400, "validation_failed", outcome.message, { fields: outcome.fields });
    }
    return reply(outcome);
  } catch (err) {
    // Stage and Postgres code only: request bodies hold visitors' personal data.
    if (err instanceof IngestError) {
      console.error("[public/leads] ingest failed", err.stage, err.code ?? "no code");
    } else {
      console.error("[public/leads] ingest failed", err instanceof Error ? err.name : "unknown");
    }
    return fail(500, "server_error", "Something went wrong on our side. Please try again.");
  }
}

async function getTenantStatus(tenantId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("tenants").select("status").eq("id", tenantId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.status as string | undefined) ?? null;
}
