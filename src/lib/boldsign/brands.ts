// Per-agency sending identity.
//
// A BoldSign "brand" carries the logo, colours, email display name and legal
// disclaimer that recipients see. Each agency gets one, derived from the
// branding it has already configured in Harbor Ops
// (src/lib/branding/agency-brand.ts), so there is no second place for an agency
// to set up its look — change the logo in Harbor Ops and re-sync.
//
// Resolution at send time is deliberately forgiving: an agency with no brand
// yet still sends, under the account default, rather than being blocked. A
// missing logo should not stop a tenancy agreement going out.

import "server-only";

import { loadAgencyBrand } from "@/lib/branding/agency-brand";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { boldSignErrorMessage, brandingApi } from "./client";
import { brandIsStale, canSendOnBehalfOf } from "./senderIdentityStatus";

export type AgencyBrandRow = {
  tenant_id: string;
  brand_id: string;
  brand_name: string;
  email_display_name: string | null;
  logo_source_url: string | null;
  primary_color: string | null;
  consent_given_at: string | null;
  last_synced_at: string | null;
};

export type SyncBrandResult =
  | { ok: true; brandId: string; created: boolean; skipped?: "unchanged" }
  | { ok: false; error: string; code?: "no_logo" | "brand_limit" };

export type AgencyIdentity = {
  /** Passed as brandId at send time. Null falls back to the account default. */
  brandId: string | null;
  /**
   * Passed as onBehalfOf at send time. Only set once the agency has verified
   * the mailbox with BoldSign — sending on behalf of an unverified identity is
   * rejected.
   */
  onBehalfOf: string | null;
};

const NO_IDENTITY: AgencyIdentity = { brandId: null, onBehalfOf: null };

/**
 * How this agency's documents should be identified.
 *
 * Deliberately forgiving: an agency with no row, or a lookup failure, sends
 * under the account default rather than being blocked. Failing to send a
 * tenancy agreement is worse than sending one with generic branding.
 */
export async function resolveAgencyIdentity(tenantId: string): Promise<AgencyIdentity> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("boldsign_agency_brands")
    .select(
      "brand_id, sender_identity_email, sender_identity_status, sender_identity_verified_at"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle<{
      brand_id: string | null;
      sender_identity_email: string | null;
      sender_identity_status: string | null;
      sender_identity_verified_at: string | null;
    }>();

  if (error) {
    console.error("[boldsign] could not resolve agency identity", {
      tenantId,
      error: error.message,
    });
    return NO_IDENTITY;
  }
  if (!data) return NO_IDENTITY;

  return {
    brandId: data.brand_id ?? null,
    // An unverified identity would have the send rejected outright, so it is
    // treated as absent until BoldSign confirms it. Both the status and the
    // timestamp have to agree — a revoked identity can keep an old timestamp
    // until the next refresh, and sending on behalf of it would fail the whole
    // document rather than just losing the branding.
    onBehalfOf: canSendOnBehalfOf(data) ? data.sender_identity_email : null,
  };
}

/** BoldSign requires a logo on create, so an agency without one can't be provisioned. */
async function fetchLogo(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch the agency logo (HTTP ${response.status}).`);
  }
  const contentType = response.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error(`The agency logo URL returned ${contentType}, not an image.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error("The agency logo is empty.");
  return { buffer, contentType };
}

function extensionFor(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

/**
 * Create or update this agency's BoldSign brand from its Harbor Ops branding.
 *
 * Idempotent: an existing mapping is edited rather than duplicated, and a
 * re-sync with unchanged branding is skipped so this is cheap to call often.
 */
export async function syncAgencyBrand(
  tenantId: string,
  options: { force?: boolean } = {}
): Promise<SyncBrandResult> {
  const admin = createSupabaseAdminClient();

  const brand = await loadAgencyBrand(tenantId);
  if (!brand) return { ok: false, error: "Unknown agency." };

  const logoUrl = brand.branding.logo_url;
  if (!logoUrl) {
    // BoldSign makes brandLogo a required parameter on createBrand, so there is
    // nothing sensible to send. Surfaced as a clear instruction rather than a
    // failed upload.
    return {
      ok: false,
      code: "no_logo",
      error:
        "This agency has no logo set. Upload one under the agency's branding settings, then sync again.",
    };
  }

  const { data: existing } = await admin
    .from("boldsign_agency_brands")
    .select("brand_id, brand_name, email_display_name, logo_source_url, primary_color")
    .eq("tenant_id", tenantId)
    .maybeSingle<{
      brand_id: string;
      brand_name: string;
      email_display_name: string | null;
      logo_source_url: string | null;
      primary_color: string | null;
    }>();

  const primaryColor = brand.branding.primary_color;
  // Drift lives in senderIdentityStatus.ts so the settings page can ask the
  // same question ("is this agency's branding out of date?") without calling
  // the API, and so the rule is unit-tested in one place.
  const unchanged =
    existing &&
    !brandIsStale(existing, {
      displayName: brand.displayName,
      logoUrl,
      primaryColor,
    });

  if (unchanged && !options.force) {
    return { ok: true, brandId: existing.brand_id, created: false, skipped: "unchanged" };
  }

  let brandId: string;
  let created = false;
  try {
    const { buffer, contentType } = await fetchLogo(logoUrl);
    const logo = {
      value: buffer,
      options: { filename: `logo.${extensionFor(contentType)}`, contentType },
    };
    const api = brandingApi();

    if (existing) {
      // Positional arguments, per the generated signature:
      // editBrand(brandId, brandName, brandLogo, backgroundColor, buttonColor,
      //           buttonTextColor, emailDisplayName, ...)
      await api.editBrand(
        existing.brand_id,
        brand.displayName,
        logo,
        undefined,
        primaryColor,
        undefined,
        brand.displayName
      );
      brandId = existing.brand_id;
    } else {
      // createBrand(brandName, brandLogo, backgroundColor, buttonColor,
      //             buttonTextColor, emailDisplayName, ...)
      const result = await api.createBrand(
        brand.displayName,
        logo,
        undefined,
        primaryColor,
        undefined,
        brand.displayName
      );
      if (!result.brandId) throw new Error("BoldSign returned no brandId.");
      brandId = result.brandId;
      created = true;
    }
  } catch (err) {
    const message = boldSignErrorMessage(err);
    await admin
      .from("boldsign_agency_brands")
      .update({ last_error: message })
      .eq("tenant_id", tenantId);

    // Measured against the sandbox on 2026-08-27: the plan allows exactly one
    // brand, and a second returns 400 with this text. It is a billing limit,
    // not a bad request, so it is worth naming rather than surfacing raw.
    if (/limit for the number of brands/i.test(message)) {
      return {
        ok: false,
        code: "brand_limit",
        error:
          "The BoldSign plan has no room for another brand, so this agency cannot get its own " +
          "branding. Either upgrade the plan to one that includes a brand per agency, or put this " +
          "agency on the sender-identity path instead.",
      };
    }
    return { ok: false, error: message };
  }

  const { error: saveError } = await admin.from("boldsign_agency_brands").upsert(
    {
      tenant_id: tenantId,
      brand_id: brandId,
      brand_name: brand.displayName,
      email_display_name: brand.displayName,
      logo_source_url: logoUrl,
      primary_color: primaryColor,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "tenant_id" }
  );

  if (saveError) {
    // The brand exists in BoldSign but isn't mapped, so the next sync would
    // create a duplicate. Log the id so it can be reattached by hand.
    console.error("[boldsign] brand synced but mapping not saved", {
      tenantId,
      brandId,
      error: saveError.message,
    });
    return { ok: false, error: saveError.message };
  }

  return { ok: true, brandId, created };
}

/**
 * Record an agency's consent to have documents sent under its identity.
 *
 * Brands don't change the From address, but the agency's name and logo still
 * appear on a legally binding document, so the permission is worth holding
 * evidence of.
 */
export async function recordBrandConsent(params: {
  tenantId: string;
  userId: string;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("boldsign_agency_brands")
    .update({
      consent_given_at: new Date().toISOString(),
      consent_given_by: params.userId,
      consent_note: params.note ?? null,
    })
    .eq("tenant_id", params.tenantId)
    .select("tenant_id");

  if (error) return { ok: false, error: error.message };

  // An UPDATE matching no rows succeeds and changes nothing. Without this the
  // caller would be told consent was recorded when no record of it exists —
  // exactly the wrong thing to be wrong about, since the point of the column
  // is holding evidence that permission was given.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        "No sending identity exists for this agency yet, so there is nothing to consent to. Sync the brand first.",
    };
  }

  return { ok: true };
}

/** The agency's current mapping, or null. Read for display, not for sending. */
export async function getAgencyBrandRow(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("boldsign_agency_brands")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data;
}
