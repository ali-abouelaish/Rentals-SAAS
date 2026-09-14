import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAgencyBrand } from "@/lib/branding/agency-brand";
import {
  brandIsStale,
  senderIdentityState,
  type SenderIdentityState,
} from "@/lib/boldsign/senderIdentityStatus";
import {
  boldSignEnv,
  boldSignHost,
  isBoldSignConfigured,
  type BoldSignEnvironment,
} from "@/lib/boldsign/config";

/**
 * What the e-signing settings page can honestly show today.
 *
 * Split into two halves because they fail for different reasons and the page
 * has to say which:
 *
 *   - PLATFORM state is ours — the API key, the environment, the webhook
 *     secret. An agency cannot fix any of it, so the page reports it rather
 *     than offering controls.
 *   - AGENCY state is theirs — the sending identity their documents go out
 *     under, and what they have already sent.
 */

export type ESigningPlatformStatus = {
  /** An API key is present on the server. */
  configured: boolean;
  environment: BoldSignEnvironment;
  /** Which data region calls go to. */
  host: string;
  /**
   * A webhook secret is set. Without it no signature ever completes: documents
   * go out, people sign them, and nothing comes back — so this is the single
   * most useful thing the page can report.
   */
  webhookConfigured: boolean;
};

export type ESigningAgencyIdentity = {
  brandId: string | null;
  brandName: string | null;
  emailDisplayName: string | null;
  senderIdentityEmail: string | null;
  senderIdentityState: SenderIdentityState;
  senderIdentityVerifiedAt: string | null;
  senderIdentityRequestedAt: string | null;
  consentGivenAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  /**
   * The agency changed its logo, name or colours after the last sync, so what
   * recipients see is out of date. Computed rather than stored — the snapshot
   * columns exist precisely so this can be answered without calling BoldSign.
   */
  brandingIsStale: boolean;
};

/**
 * The branding a sync would push, so the page can show the agency what they
 * are about to apply and why it can't be applied yet.
 */
export type ESigningBrandSource = {
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
};

export type ESigningActivity = {
  total: number;
  awaitingSignature: number;
  completed: number;
  failed: number;
  /** True when any document was raised against the sandbox. */
  hasSandboxDocuments: boolean;
};

/**
 * Read at call time, never at module load, so a deployment that sets the
 * variables after boot still reports them correctly.
 */
export function getESigningPlatformStatus(): ESigningPlatformStatus {
  return {
    configured: isBoldSignConfigured(),
    environment: boldSignEnv(),
    host: boldSignHost(),
    webhookConfigured: Boolean(process.env.BOLDSIGN_WEBHOOK_SECRET?.trim()),
  };
}

/**
 * The agency's sending identity, plus the branding a sync would push.
 *
 * Returned together because the page always needs both: what BoldSign holds,
 * and what Harbor Ops would send it. Comparing the two is what produces the
 * "your branding has changed" prompt, and the source is what explains why an
 * agency with no logo cannot provision at all.
 *
 * Identity is read through the SSR client so RLS scopes it; the branding
 * source uses the admin client internally (`loadAgencyBrand`) because it spans
 * two branding stores, one of which isn't tenant-readable.
 */
export async function getESigningIdentity(tenantId: string): Promise<{
  identity: ESigningAgencyIdentity | null;
  source: ESigningBrandSource | null;
}> {
  const supabase = createSupabaseServerClient();

  const [{ data, error }, brand] = await Promise.all([
    supabase
      .from("boldsign_agency_brands")
      .select(
        "brand_id, brand_name, email_display_name, logo_source_url, primary_color, sender_identity_email, sender_identity_status, sender_identity_verified_at, sender_identity_requested_at, consent_given_at, last_synced_at, last_error"
      )
      .eq("tenant_id", tenantId)
      .maybeSingle<{
        brand_id: string | null;
        brand_name: string | null;
        email_display_name: string | null;
        logo_source_url: string | null;
        primary_color: string | null;
        sender_identity_email: string | null;
        sender_identity_status: string | null;
        sender_identity_verified_at: string | null;
        sender_identity_requested_at: string | null;
        consent_given_at: string | null;
        last_synced_at: string | null;
        last_error: string | null;
      }>(),
    loadAgencyBrand(tenantId).catch(() => null),
  ]);

  const source: ESigningBrandSource | null = brand
    ? {
        displayName: brand.displayName,
        logoUrl: brand.branding.logo_url ?? null,
        primaryColor: brand.branding.primary_color ?? null,
      }
    : null;

  // The table is applied by hand; a missing one means "not provisioned", which
  // is what null already says.
  if (error || !data) return { identity: null, source };

  return {
    identity: {
      brandId: data.brand_id,
      brandName: data.brand_name,
      emailDisplayName: data.email_display_name,
      senderIdentityEmail: data.sender_identity_email,
      senderIdentityState: senderIdentityState(data.sender_identity_status),
      senderIdentityVerifiedAt: data.sender_identity_verified_at,
      senderIdentityRequestedAt: data.sender_identity_requested_at,
      consentGivenAt: data.consent_given_at,
      lastSyncedAt: data.last_synced_at,
      lastError: data.last_error,
      // Only meaningful once a brand exists — an agency with no brand isn't
      // "stale", it just hasn't started.
      brandingIsStale: Boolean(data.brand_id) && Boolean(source) && brandIsStale(data, source!),
    },
    source,
  };
}

/**
 * A count of what the agency has sent, by outcome.
 *
 * Counted in JS from the status column rather than with a grouped query,
 * because PostgREST has no GROUP BY and adding an RPC for four numbers on a
 * settings page is not worth a migration.
 */
export async function getESigningActivity(tenantId: string): Promise<ESigningActivity> {
  const empty: ESigningActivity = {
    total: 0,
    awaitingSignature: 0,
    completed: 0,
    failed: 0,
    hasSandboxDocuments: false,
  };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boldsign_documents")
    .select("status, is_sandbox")
    .eq("tenant_id", tenantId);

  if (error || !data) return empty;

  return data.reduce<ESigningActivity>((acc, row) => {
    acc.total += 1;
    if (row.status === "awaiting_signature" || row.status === "partially_signed") {
      acc.awaitingSignature += 1;
    }
    if (row.status === "completed") acc.completed += 1;
    if (row.status === "failed") acc.failed += 1;
    if (row.is_sandbox) acc.hasSandboxDocuments = true;
    return acc;
  }, empty);
}
