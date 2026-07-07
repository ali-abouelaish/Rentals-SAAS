"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { unitSchema, unitEditSchema, unitStatusUpdateSchema, type UnitFormValues, type UnitStatusUpdateValues } from "../domain/schemas";

export async function createUnit(values: UnitFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = unitSchema.parse(values);

  // Default deposit to max_price_pcm if not set
  const deposit = payload.deposit ?? payload.max_price_pcm ?? undefined;

  const { data, error } = await supabase
    .from("units")
    .insert({
      ...payload,
      deposit,
      tenant_id: profile.tenant_id,
      portfolio_id: undefined,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export async function updateUnit(id: string, values: Partial<UnitFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Edit path: no validations, all fields nullable; null/undefined values are
  // dropped so existing DB values are preserved when the user leaves a field blank.
  // Exception: pm_tenant_id and resident_id may legitimately be set to null
  // (unlinking a tenant), so we keep null when the caller explicitly passed it.
  const parsed = unitEditSchema.parse(values);
  const explicitNullableKeys = new Set(["pm_tenant_id", "resident_id"]);
  const cleaned = Object.fromEntries(
    Object.entries(parsed).filter(([k, v]) => {
      if (v === undefined) return false;
      if (v === null) return explicitNullableKeys.has(k) && k in (values as object);
      return true;
    })
  );
  const updates: Record<string, unknown> = { ...cleaned, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("units")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export async function updateUnitStatus(id: string, values: UnitStatusUpdateValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = unitStatusUpdateSchema.parse(values);

  const updates: Record<string, unknown> = {
    status: payload.status,
    updated_at: new Date().toISOString(),
  };

  if (payload.available_date !== undefined) updates.available_date = payload.available_date || null;
  if (payload.notice_given !== undefined) updates.notice_given = payload.notice_given;

  const { data, error } = await supabase
    .from("units")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export type DeleteUnitResult =
  | { ok: true }
  | { ok: false; error: string; blockedByHistory?: boolean };

export async function deleteUnit(
  id: string,
  options?: { force?: boolean }
): Promise<DeleteUnitResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Dev-only escape hatch: force deletion regardless of tenancy history. The DB
  // cascade (property_contracts, unit_rent_payments) does the actual cleanup.
  // Never honoured in production so live data can't be wiped by accident.
  const force = options?.force === true && process.env.NODE_ENV !== "production";

  // Load the room first so we can guard occupied/tenanted rooms. Deleting a unit
  // cascades to property_contracts and unit_rent_payments (on delete cascade),
  // so an unguarded delete would silently wipe tenancy + payment history.
  const { data: unit, error: loadError } = await supabase
    .from("units")
    .select("id, status, pm_tenant_id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (loadError || !unit) return { ok: false, error: "Room not found" };

  if (!force) {
    if (unit.pm_tenant_id || unit.status === "occupied") {
      return { ok: false, error: "This room has an active tenant. End the tenancy before deleting it.", blockedByHistory: true };
    }

    // Any contract (past or present) means deleting would cascade-wipe tenancy
    // history — block it so rooms with a record can't be silently erased.
    const { count } = await supabase
      .from("property_contracts")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", id)
      .eq("tenant_id", profile.tenant_id);
    if ((count ?? 0) > 0) {
      return { ok: false, error: "This room has tenancy history and can't be deleted.", blockedByHistory: true };
    }
  }

  const { error } = await supabase
    .from("units")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/properties");
  return { ok: true };
}
