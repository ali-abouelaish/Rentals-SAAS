"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { tenantChargeSchema } from "../domain/tenant-charges";

type Input = z.infer<typeof tenantChargeSchema>;

function normaliseRow(parsed: Input) {
  return {
    contract_id: parsed.contract_id,
    charge_type: parsed.charge_type,
    label: parsed.label.trim(),
    amount: Math.round(parsed.amount_pounds * 100),
    recurrence_day: parsed.recurrence_day,
    start_date: parsed.start_date,
    end_date: parsed.end_date || null,
    is_active: parsed.is_active,
    notes: parsed.notes?.trim() || null,
  };
}

export async function createTenantCharge(raw: Input) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = tenantChargeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_recurring_charges")
    .insert({ tenant_id: profile.tenant_id, ...normaliseRow(parsed.data) });
  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/finances/tenant-charges");
  return { success: true };
}

export async function updateTenantCharge(id: string, raw: Input) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = tenantChargeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_recurring_charges")
    .update(normaliseRow(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/finances/tenant-charges");
  return { success: true };
}

export async function deleteTenantCharge(id: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("tenant_recurring_charges").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/finances/tenant-charges");
  return { success: true };
}
