import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { OwnerLandlord } from "@/features/properties/domain/types";
import type { OwnerDetail, OwnerListItem, OwnerPropertySummary } from "../domain/types";

/**
 * Owners for /owners, alphabetical, each with a property count and a snapshot
 * of their latest statement so the list doubles as a "who needs sending" view.
 *
 * Assembled with a handful of scoped queries joined in JS rather than one
 * nested select — the statement snapshot is a per-owner "latest row", which
 * PostgREST cannot express.
 */
export async function listOwners(search?: string): Promise<OwnerListItem[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  let ownerQuery = supabase
    .from("owner_landlords")
    .select(
      "id, name, email, phone, management_fee_type, management_fee_percent, management_fee_amount, contract_expiry_date"
    )
    .order("name", { ascending: true });

  const term = search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,()]/g, " ").trim();
    if (escaped) {
      ownerQuery = ownerQuery.or(
        `name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`
      );
    }
  }

  const { data: owners, error } = await ownerQuery;
  if (error) throw new Error(error.message);

  const ownerRows = (owners ?? []) as Array<
    Pick<
      OwnerLandlord,
      | "id"
      | "name"
      | "email"
      | "phone"
      | "management_fee_type"
      | "management_fee_percent"
      | "management_fee_amount"
      | "contract_expiry_date"
    >
  >;
  if (ownerRows.length === 0) return [];

  const ownerIds = ownerRows.map((o) => o.id);

  const [{ data: props, error: propErr }, { data: statements, error: stErr }] = await Promise.all([
    supabase.from("properties").select("id, owner_landlord_id").in("owner_landlord_id", ownerIds),
    supabase
      .from("owner_statements")
      .select("owner_id, period_year, period_month, status, closing_balance_pence")
      .in("owner_id", ownerIds)
      .neq("status", "void")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false }),
  ]);
  if (propErr) throw new Error(propErr.message);
  if (stErr) throw new Error(stErr.message);

  const propertyCount = new Map<string, number>();
  for (const p of (props ?? []) as Array<{ owner_landlord_id: string | null }>) {
    if (!p.owner_landlord_id) continue;
    propertyCount.set(p.owner_landlord_id, (propertyCount.get(p.owner_landlord_id) ?? 0) + 1);
  }

  type StatementRow = {
    owner_id: string;
    period_year: number;
    period_month: number;
    status: string;
    closing_balance_pence: number;
  };
  // Rows arrive newest-period-first, so the first per owner is the latest.
  const latest = new Map<string, StatementRow>();
  const unsent = new Map<string, number>();
  for (const s of (statements ?? []) as StatementRow[]) {
    if (!latest.has(s.owner_id)) latest.set(s.owner_id, s);
    if (s.status === "draft" || s.status === "approved") {
      unsent.set(s.owner_id, (unsent.get(s.owner_id) ?? 0) + 1);
    }
  }

  return ownerRows.map((o) => {
    const last = latest.get(o.id);
    return {
      id: o.id,
      name: o.name,
      email: o.email,
      phone: o.phone,
      management_fee_type: o.management_fee_type,
      management_fee_percent: o.management_fee_percent,
      management_fee_amount: o.management_fee_amount,
      contract_expiry_date: o.contract_expiry_date,
      property_count: propertyCount.get(o.id) ?? 0,
      last_statement_period: last ? { year: last.period_year, month: last.period_month } : null,
      last_statement_status: last?.status ?? null,
      closing_balance_pence: last?.closing_balance_pence ?? null,
      unsent_count: unsent.get(o.id) ?? 0,
    };
  });
}

/** The owner record plus their properties, for /owners/[id]. */
export async function getOwnerById(id: string): Promise<OwnerDetail | null> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: owner, error } = await supabase
    .from("owner_landlords")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!owner) return null;

  const { data: props, error: propErr } = await supabase
    .from("properties")
    .select("id, name, address_line_1, postcode, property_type, total_rooms")
    .eq("owner_landlord_id", id)
    .order("name", { ascending: true });
  if (propErr) throw new Error(propErr.message);

  type PropRow = {
    id: string;
    name: string;
    address_line_1: string | null;
    postcode: string | null;
    property_type: string | null;
    total_rooms: number | null;
  };
  const propertyRows = (props ?? []) as PropRow[];

  // Occupancy per property, so the Properties tab shows let vs. empty.
  const occupied = new Map<string, number>();
  const totalUnits = new Map<string, number>();
  if (propertyRows.length > 0) {
    const { data: units, error: unitErr } = await supabase
      .from("units")
      .select("id, property_id, status")
      .in(
        "property_id",
        propertyRows.map((p) => p.id)
      );
    if (unitErr) throw new Error(unitErr.message);
    for (const u of (units ?? []) as Array<{ property_id: string; status: string }>) {
      totalUnits.set(u.property_id, (totalUnits.get(u.property_id) ?? 0) + 1);
      if (u.status === "occupied") {
        occupied.set(u.property_id, (occupied.get(u.property_id) ?? 0) + 1);
      }
    }
  }

  const properties: OwnerPropertySummary[] = propertyRows.map((p) => ({
    ...p,
    occupied_units: occupied.get(p.id) ?? 0,
    total_units: totalUnits.get(p.id) ?? 0,
  }));

  return { owner: owner as OwnerLandlord, properties };
}
