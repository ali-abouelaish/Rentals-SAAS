import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { loadAgencyBrand } from "@/lib/branding/agency-brand";
import {
  brandIsStale,
  senderIdentityState,
  type SenderIdentityState,
} from "@/lib/boldsign/senderIdentityStatus";

export type ESigningAgencyRow = {
  tenant: { id: string; name: string; slug: string };
  /** Null when the agency has never been provisioned. */
  brandId: string | null;
  brandName: string | null;
  consentGivenAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  brandingIsStale: boolean;
  /** BoldSign requires a logo to create a brand, so this blocks provisioning. */
  hasLogo: boolean;
  senderIdentityEmail: string | null;
  senderIdentityState: SenderIdentityState;
};

/**
 * Every agency alongside its BoldSign sending identity, for the super-admin
 * e-signing screen.
 *
 * Brand state is per-agency and provisioned on demand, so without this view
 * there is no way to answer "which agencies are still sending unbranded?" —
 * the thing that actually matters once the plan allows a brand each.
 *
 * The logo check is the other half: it is the single commonest reason a sync
 * fails, and knowing it up front turns a failed click into a prerequisite
 * shown before anyone clicks.
 */
export async function getESigningAgencies(): Promise<ESigningAgencyRow[]> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: tenants, error: tenantsError }, { data: brands, error: brandsError }] =
    await Promise.all([
      admin.from("tenants").select("id, name, slug").order("name", { ascending: true }),
      admin.from("boldsign_agency_brands").select("*"),
    ]);

  if (tenantsError) throw new Error(tenantsError.message);
  // The table is applied by hand — report every agency as unprovisioned rather
  // than failing the page.
  const brandRows = brandsError ? [] : (brands ?? []);

  const byTenant = new Map(brandRows.map((row) => [row.tenant_id as string, row]));

  // Branding lives across two stores, so it has to be resolved per tenant
  // rather than joined. Sequential would be one round trip per agency; these
  // are independent reads, so they go together.
  const sources = await Promise.all(
    (tenants ?? []).map((tenant) =>
      loadAgencyBrand(tenant.id as string).catch(() => null)
    )
  );

  return (tenants ?? []).map((tenant, index) => {
    const row = byTenant.get(tenant.id as string);
    const source = sources[index];
    const logoUrl = source?.branding.logo_url ?? null;

    return {
      tenant: {
        id: tenant.id as string,
        name: tenant.name as string,
        slug: tenant.slug as string,
      },
      brandId: (row?.brand_id as string | null) ?? null,
      brandName: (row?.brand_name as string | null) ?? null,
      consentGivenAt: (row?.consent_given_at as string | null) ?? null,
      lastSyncedAt: (row?.last_synced_at as string | null) ?? null,
      lastError: (row?.last_error as string | null) ?? null,
      hasLogo: Boolean(logoUrl),
      brandingIsStale: Boolean(
        row?.brand_id &&
          source &&
          brandIsStale(
            {
              brand_name: (row.brand_name as string | null) ?? null,
              email_display_name: (row.email_display_name as string | null) ?? null,
              logo_source_url: (row.logo_source_url as string | null) ?? null,
              primary_color: (row.primary_color as string | null) ?? null,
            },
            {
              displayName: source.displayName,
              logoUrl,
              primaryColor: source.branding.primary_color ?? null,
            }
          )
      ),
      senderIdentityEmail: (row?.sender_identity_email as string | null) ?? null,
      senderIdentityState: senderIdentityState(
        (row?.sender_identity_status as string | null) ?? null
      ),
    };
  });
}
