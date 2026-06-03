"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { overheadSchema } from "../domain/overheads";
import { assertMonthOpen } from "../lib/assertMonthOpen";

type Input = z.infer<typeof overheadSchema>;

function normaliseRow(parsed: Input) {
  return {
    category: parsed.category,
    label: parsed.label.trim(),
    amount: Math.round(parsed.amount_pounds * 100),
    vendor: parsed.vendor?.trim() || null,
    cost_mode: parsed.cost_mode,
    recurrence_day: parsed.recurrence_day ? Number(parsed.recurrence_day) : null,
    amortise_months: parsed.amortise_months ? Number(parsed.amortise_months) : null,
    amortise_start_date: parsed.amortise_start_date || null,
    date_incurred: parsed.date_incurred,
    is_active: parsed.is_active,
    notes: parsed.notes?.trim() || null,
  };
}

function monthOf(dateIso: string): { year: number; month: number } {
  const d = new Date(dateIso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export async function createOverhead(raw: Input) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = overheadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }
  const row = normaliseRow(parsed.data);

  if (row.cost_mode === "one_off") {
    const { year, month } = monthOf(row.date_incurred);
    const guard = await assertMonthOpen(year, month);
    if ("error" in guard) return { error: guard.error };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("business_overheads")
    .insert({ tenant_id: profile.tenant_id, ...row });
  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/finances/overheads");
  return { success: true };
}

export async function updateOverhead(id: string, raw: Input) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = overheadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }
  const row = normaliseRow(parsed.data);

  if (row.cost_mode === "one_off") {
    const { year, month } = monthOf(row.date_incurred);
    const guard = await assertMonthOpen(year, month);
    if ("error" in guard) return { error: guard.error };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("business_overheads")
    .update(row)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/finances/overheads");
  return { success: true };
}

export async function deleteOverhead(id: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Look up the row first so we can guard against deleting an entry whose
  // one-off date falls inside a closed month.
  const { data: existing, error: readErr } = await supabase
    .from("business_overheads")
    .select("cost_mode, date_incurred")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!existing) return { error: "Overhead not found" };

  if (existing.cost_mode === "one_off") {
    const { year, month } = monthOf(existing.date_incurred);
    const guard = await assertMonthOpen(year, month);
    if ("error" in guard) return { error: guard.error };
  }

  const { error } = await supabase.from("business_overheads").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/finances");
  revalidatePath("/finances/overheads");
  return { success: true };
}
