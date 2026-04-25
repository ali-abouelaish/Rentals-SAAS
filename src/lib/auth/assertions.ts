import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "./requireRole";
import { ADMIN_ROLES } from "./roles";

export class AssertionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "AssertionError";
  }
}

export type AssertedUnit = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_number: string | null;
  unit_type: string;
};

export type AssertedContract = {
  id: string;
  tenant_id: string;
  unit_id: string;
  status: string;
  actual_end_date: string | null;
};

/**
 * Read access to a unit's tenant history.
 *
 * Kept separate from a generic `assertUnitAccess` so we can later restrict it
 * (e.g. agency vs PM workspace, or per-portfolio sharing) without touching
 * the rest of the unit read path.
 */
export async function assertTenantHistoryRead(unitId: string): Promise<AssertedUnit> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("units")
    .select("id, tenant_id, property_id, room_number, unit_type")
    .eq("id", unitId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (error) throw new AssertionError(error.message, 500);
  if (!data) throw new AssertionError("Unit not found or not accessible", 404);

  return data as AssertedUnit;
}

/**
 * Read access to the workspace's global search index.
 *
 * Search has no per-resource assertion — the tenant_id is the only
 * scoping check, and it's applied as a SQL filter inside `global_search`,
 * not row-by-row in app code. Returning the tenant_id from this helper
 * keeps that decision centralised: the search route never reads
 * profile.tenant_id directly.
 */
export async function assertSearchAccess(): Promise<{ tenantId: string }> {
  const profile = await requireUserProfile();
  return { tenantId: profile.tenant_id };
}

/**
 * Mutation access for closing out a tenancy. Requires admin/super_admin
 * (the codebase's "manager+" tier — see ADMIN_ROLES).
 */
export async function assertContractCloseout(
  contractId: string
): Promise<AssertedContract> {
  const profile = await requireUserProfile();
  const role = (profile.role ?? "").toLowerCase();
  if (!ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number])) {
    throw new AssertionError("Insufficient role to close out contracts", 403);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("property_contracts")
    .select("id, tenant_id, unit_id, status, actual_end_date")
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (error) throw new AssertionError(error.message, 500);
  if (!data) throw new AssertionError("Contract not found or not accessible", 404);

  return data as AssertedContract;
}

export type AssertedKey = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  unit_id: string | null;
  set_name: string;
  copy_label: string;
  status: "in_office" | "loaned" | "with_tenant" | "lost" | "destroyed";
};

export type AssertedActor = {
  tenantId: string;
  userId: string;
};

function isAdmin(role: string | null | undefined) {
  const r = (role ?? "").toLowerCase();
  return ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]);
}

export async function assertKeyAccess(keyId: string): Promise<AssertedKey> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("keys")
    .select("id, tenant_id, property_id, unit_id, set_name, copy_label, status")
    .eq("id", keyId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (error) throw new AssertionError(error.message, 500);
  if (!data) throw new AssertionError("Key not found or not accessible", 404);

  return data as AssertedKey;
}

export async function assertKeyMutate(keyId: string): Promise<{ key: AssertedKey; actor: AssertedActor }> {
  const profile = await requireUserProfile();
  if (!isAdmin(profile.role)) {
    throw new AssertionError("Insufficient role to modify keys", 403);
  }
  const key = await assertKeyAccess(keyId);
  return { key, actor: { tenantId: profile.tenant_id, userId: profile.id } };
}

export async function assertKeyCreate(target: {
  propertyId?: string | null;
  unitId?: string | null;
}): Promise<AssertedActor> {
  const profile = await requireUserProfile();
  if (!isAdmin(profile.role)) {
    throw new AssertionError("Insufficient role to register keys", 403);
  }

  if (!target.propertyId && !target.unitId) {
    throw new AssertionError("Key must be attached to a property or unit", 400);
  }

  const supabase = createSupabaseServerClient();

  if (target.propertyId) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, tenant_id")
      .eq("id", target.propertyId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (error) throw new AssertionError(error.message, 500);
    if (!data) throw new AssertionError("Property not found or not accessible", 404);
  }

  if (target.unitId) {
    const { data, error } = await supabase
      .from("units")
      .select("id, tenant_id, property_id")
      .eq("id", target.unitId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (error) throw new AssertionError(error.message, 500);
    if (!data) throw new AssertionError("Unit not found or not accessible", 404);
    if (target.propertyId && data.property_id !== target.propertyId) {
      throw new AssertionError("Unit does not belong to that property", 400);
    }
  }

  return { tenantId: profile.tenant_id, userId: profile.id };
}

/**
 * Read access for the portfolio-wide /keys dashboard. Returns the
 * tenant id so the page never has to read it directly off the profile.
 */
export async function assertKeysDashboardRead(): Promise<{ tenantId: string }> {
  const profile = await requireUserProfile();
  return { tenantId: profile.tenant_id };
}
