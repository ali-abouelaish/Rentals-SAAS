"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  certificateStatus,
  type Certificate,
  type CertificateStatus,
} from "../domain/types";

const CERT_SELECT = `
  id, tenant_id, property_id, unit_id, type, issue_date, expiry_date,
  document_url, contractor_id, reference, notes, created_at, updated_at,
  contractor:maintenance_suppliers(id, name, email),
  unit:units(id, room_number, unit_type)
`;

/** Normalise a supabase to-one embed (typed as array, returned as object). */
function one<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] ?? null) as T | null;
  return (rel ?? null) as T | null;
}

function mapRow(row: Record<string, unknown>): Certificate {
  return {
    ...(row as unknown as Certificate),
    contractor: one(row.contractor),
    unit: one(row.unit),
    property: one(row.property),
  };
}

/** All certificates for one property, soonest expiry first. */
export async function getCertificatesForProperty(
  propertyId: string
): Promise<Certificate[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("certificates")
    .select(CERT_SELECT)
    .eq("property_id", propertyId)
    .order("expiry_date", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

/**
 * Worst certificate status per property (expired > expiring_soon > valid),
 * for the red/amber/green shield on the properties list. Properties with no
 * certificates are absent from the map.
 */
export async function getCertificateStatusByProperty(): Promise<
  Record<string, CertificateStatus>
> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("certificates")
    .select("property_id, expiry_date");
  if (error) throw new Error(error.message);

  const RANK: Record<CertificateStatus, number> = { expired: 2, expiring_soon: 1, valid: 0 };
  const out: Record<string, CertificateStatus> = {};
  const todayISO = new Date().toISOString().slice(0, 10);
  for (const row of (data ?? []) as { property_id: string; expiry_date: string }[]) {
    const status = certificateStatus(row.expiry_date, todayISO);
    const current = out[row.property_id];
    if (!current || RANK[status] > RANK[current]) out[row.property_id] = status;
  }
  return out;
}

/** Every certificate in the portfolio with its property, for the compliance dashboard. */
export async function getComplianceOverview(): Promise<Certificate[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("certificates")
    .select(`${CERT_SELECT}, property:properties(id, name, address_line_1, postcode)`)
    .order("expiry_date", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}
