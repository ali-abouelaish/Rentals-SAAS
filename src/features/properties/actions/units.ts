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
  const parsed = unitEditSchema.parse(values);
  const cleaned = Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
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

export async function deleteUnit(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("units")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
}
