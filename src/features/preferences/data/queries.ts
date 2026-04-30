import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type AgencyBranding, normalizeBranding } from "@/lib/email/branding";

export type PreferenceContext = {
  pmTenantId: string;
  pmTenantFirstName: string;
  pmTenantFullName: string;
  pmTenantEmail: string;
  agencyId: string;
  agencyName: string;
  branding: AgencyBranding;
  propertyAddress: string;
};

export type CommunicationRequestRow = {
  id: string;
  request_type: "email_change" | "alternative_format" | "data_access" | "other";
  status: "pending" | "approved" | "rejected" | "completed";
  payload: Record<string, unknown>;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

function buildAddress(
  property: { address_line_1: string; address_line_2: string | null; postcode: string | null } | null
): string {
  if (!property) return "";
  return [property.address_line_1, property.address_line_2, property.postcode]
    .filter(Boolean)
    .join(", ");
}

export async function loadPreferenceContext(pmTenantId: string): Promise<PreferenceContext | null> {
  const admin = createSupabaseAdminClient();

  const { data: pm, error: pmErr } = await admin
    .from("pm_tenants")
    .select("id, full_name, email, tenant_id")
    .eq("id", pmTenantId)
    .maybeSingle();
  if (pmErr || !pm) return null;

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .select("id, name, branding")
    .eq("id", pm.tenant_id)
    .maybeSingle();
  if (tErr || !tenant) return null;

  // Pick the most recent active contract for the property address. A renter
  // can in theory move properties; using the latest active row matches what
  // they'd see in their email.
  const { data: contract } = await admin
    .from("property_contracts")
    .select(`
      id, status, start_date,
      unit:units(
        property:properties(address_line_1, address_line_2, postcode)
      )
    `)
    .eq("pm_tenant_id", pmTenantId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const propertyAddress = buildAddress(
    (contract?.unit as { property: { address_line_1: string; address_line_2: string | null; postcode: string | null } | null } | null | undefined)?.property ?? null
  );

  const fullName = (pm.full_name as string) ?? "";
  const firstName = fullName.split(" ")[0] || fullName;

  return {
    pmTenantId: pm.id as string,
    pmTenantFullName: fullName,
    pmTenantFirstName: firstName,
    pmTenantEmail: (pm.email as string) ?? "",
    agencyId: tenant.id as string,
    agencyName: (tenant.name as string) ?? "",
    branding: normalizeBranding(tenant.branding),
    propertyAddress,
  };
}

export async function loadRequestsForPmTenant(pmTenantId: string): Promise<CommunicationRequestRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenant_communication_requests")
    .select("id, request_type, status, payload, resolution_notes, created_at, resolved_at")
    .eq("pm_tenant_id", pmTenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommunicationRequestRow[];
}
