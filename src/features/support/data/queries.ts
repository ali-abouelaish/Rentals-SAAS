import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  SupportActiveTicket,
  SupportProperty,
  SupportPmTenant,
  SupportUnit,
} from "../domain/types";

function buildAddress(p: {
  address_line_1: string;
  address_line_2: string | null;
  postcode: string | null;
  area: string | null;
}): string {
  return [p.address_line_1, p.address_line_2, p.area, p.postcode]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(", ");
}

function buildUnitLabel(unit: {
  unit_type: string;
  room_number: string | null;
  room_type: string | null;
}): string {
  if (unit.unit_type === "room") {
    const rn = unit.room_number ? `Room ${unit.room_number}` : "Room";
    const rt = unit.room_type
      ? ` · ${unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)}`
      : "";
    return `${rn}${rt}`;
  }
  return unit.unit_type === "studio" ? "Studio" : "Whole flat";
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export async function getSupportBootstrap(
  tenantId: string
): Promise<{ properties: SupportProperty[] }> {
  const admin = createSupabaseAdminClient();

  const { data: properties, error } = await admin
    .from("properties")
    .select(
      `id, name, address_line_1, address_line_2, postcode, area,
       units:units(id, unit_type, room_number, room_type, pm_tenant_id)`
    )
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw error;

  const result: SupportProperty[] = (properties ?? []).map((p) => {
    const rawUnits = Array.isArray(p.units) ? p.units : [];
    const units: SupportUnit[] = rawUnits.map((u) => ({
      id: u.id as string,
      label: buildUnitLabel({
        unit_type: u.unit_type as string,
        room_number: (u.room_number as string | null) ?? null,
        room_type: (u.room_type as string | null) ?? null,
      }),
      hasActiveTenancy: Boolean(u.pm_tenant_id),
    }));

    return {
      id: p.id as string,
      name: p.name as string,
      address: buildAddress({
        address_line_1: p.address_line_1 as string,
        address_line_2: (p.address_line_2 as string | null) ?? null,
        postcode: (p.postcode as string | null) ?? null,
        area: (p.area as string | null) ?? null,
      }),
      units,
    };
  });

  const withActiveOnly = result
    .map((p) => ({ ...p, units: p.units.filter((u) => u.hasActiveTenancy) }))
    .filter((p) => p.units.length > 0);

  return { properties: withActiveOnly };
}

export async function getSupportPmTenantsForUnit(
  tenantId: string,
  unitId: string
): Promise<SupportPmTenant[]> {
  const admin = createSupabaseAdminClient();

  const { data: unit, error: unitErr } = await admin
    .from("units")
    .select("id, tenant_id, pm_tenant_id")
    .eq("id", unitId)
    .maybeSingle();
  if (unitErr) throw unitErr;
  if (!unit || unit.tenant_id !== tenantId || !unit.pm_tenant_id) return [];

  const { data: pm, error: pmErr } = await admin
    .from("pm_tenants")
    .select("id, full_name")
    .eq("id", unit.pm_tenant_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (pmErr) throw pmErr;
  if (!pm) return [];

  return [
    {
      id: pm.id as string,
      fullName: pm.full_name as string,
      firstName: firstNameOf(pm.full_name as string),
    },
  ];
}

export async function getSupportActiveTickets(
  tenantId: string,
  pmTenantId: string
): Promise<SupportActiveTicket[]> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("maintenance_tickets")
    .select("reference, description, priority, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("pm_tenant_id", pmTenantId)
    .not("status", "in", "(resolved,closed,cancelled)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((t) => ({
    reference: t.reference as string,
    descriptionPreview:
      (t.description as string).length > 120
        ? `${(t.description as string).slice(0, 120)}…`
        : (t.description as string),
    priority: t.priority as SupportActiveTicket["priority"],
    status: t.status as SupportActiveTicket["status"],
    createdAt: t.created_at as string,
  }));
}
