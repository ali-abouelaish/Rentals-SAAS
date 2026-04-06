"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

// ──────────────────────────────────────────────────────────
// Zod Schemas
// ──────────────────────────────────────────────────────────

const CostSchema = z.object({
  property_id: z.string().uuid(),
  unit_id: z.string().uuid().nullable().optional(),
  cost_type: z.enum([
    "council_tax", "bills", "cleaning", "maintenance", "insurance",
    "owner_rent", "agency_fee", "furniture", "other",
  ]),
  cost_label: z.string().nullable().optional(),
  amount_pounds: z.number().positive("Amount must be positive"), // UI sends £, we convert to pence
  cost_mode: z.enum(["recurring", "one_off", "amortised"]),
  recurrence_day: z.number().int().min(1).max(31).nullable().optional(),
  amortise_months: z.number().int().positive().nullable().optional(),
  amortise_start_date: z.string().nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  date_incurred: z.string(),
  notes: z.string().nullable().optional(),
});

const TargetSchema = z.object({
  property_id: z.string().uuid(),
  target_profit_pcm: z.number().int().nonnegative(),
});

// ──────────────────────────────────────────────────────────
// Cost Actions
// ──────────────────────────────────────────────────────────

export async function createPropertyCost(raw: z.infer<typeof CostSchema>) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = CostSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }
  const data = parsed.data;
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("property_costs").insert({
    property_id: data.property_id,
    unit_id: data.unit_id ?? null,
    cost_type: data.cost_type,
    cost_label: data.cost_label ?? null,
    amount: Math.round(data.amount_pounds * 100), // £ → pence
    cost_mode: data.cost_mode,
    recurrence_day: data.recurrence_day ?? null,
    amortise_months: data.amortise_months ?? null,
    amortise_start_date: data.amortise_start_date ?? null,
    purchase_date: data.purchase_date ?? null,
    date_incurred: data.date_incurred,
    notes: data.notes ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/profitability");
  revalidatePath(`/profitability/${data.property_id}`);
  return { success: true };
}

export async function updatePropertyCost(
  id: string,
  raw: z.infer<typeof CostSchema>
) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = CostSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }
  const data = parsed.data;
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("property_costs")
    .update({
      cost_type: data.cost_type,
      cost_label: data.cost_label ?? null,
      amount: Math.round(data.amount_pounds * 100),
      cost_mode: data.cost_mode,
      recurrence_day: data.recurrence_day ?? null,
      amortise_months: data.amortise_months ?? null,
      amortise_start_date: data.amortise_start_date ?? null,
      purchase_date: data.purchase_date ?? null,
      date_incurred: data.date_incurred,
      notes: data.notes ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/profitability");
  revalidatePath(`/profitability/${data.property_id}`);
  return { success: true };
}

export async function deletePropertyCost(id: string, propertyId: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("property_costs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/profitability");
  revalidatePath(`/profitability/${propertyId}`);
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// Target Actions
// ──────────────────────────────────────────────────────────

export async function upsertPropertyTarget(raw: z.infer<typeof TargetSchema>) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = TargetSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }
  const { property_id, target_profit_pcm } = parsed.data;
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("property_targets").upsert(
    { property_id, target_profit_pcm, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,property_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/profitability");
  revalidatePath(`/profitability/${property_id}`);
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// Alert Actions
// ──────────────────────────────────────────────────────────

export async function resolveAlert(alertId: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profitability_alerts")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", alertId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/profitability");
  return { success: true };
}
