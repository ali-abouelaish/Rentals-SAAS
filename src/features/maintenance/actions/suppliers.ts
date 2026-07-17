"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

// ──────────────────────────────────────────────────────────
// Zod Schema
// ──────────────────────────────────────────────────────────

const TRADES = ["plumbing", "electrical", "structural", "appliance", "pest_control", "cleaning", "decoration", "other"] as const;

const SupplierSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200, "Max 200 characters"),
  trade: z.enum(TRADES),
  contact_name: z.string().max(200, "Max 200 characters").nullable().optional(),
  phone: z.string().max(50, "Max 50 characters").nullable().optional(),
  email: z
    .string()
    .email("Enter a valid email address")
    .max(255)
    .nullable()
    .optional()
    .or(z.literal("")),
  notes: z.string().max(2000, "Max 2000 characters").nullable().optional(),
});

type SupplierInput = z.infer<typeof SupplierSchema>;

function toRow(d: SupplierInput) {
  return {
    name: d.name.trim(),
    trade: d.trade,
    contact_name: d.contact_name?.trim() || null,
    phone: d.phone?.trim() || null,
    email: d.email?.trim() || null,
    notes: d.notes?.trim() || null,
  };
}

// ──────────────────────────────────────────────────────────
// Supplier CRUD
// ──────────────────────────────────────────────────────────

export async function createSupplier(raw: SupplierInput) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = SupplierSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("maintenance_suppliers").insert({
    tenant_id: profile.tenant_id,
    ...toRow(parsed.data),
  });
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { success: true };
}

export async function updateSupplier(id: string, raw: SupplierInput) {
  await requireRole([...ADMIN_ROLES]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid supplier id" };
  const parsed = SupplierSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("maintenance_suppliers")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  // Keep the denormalised assigned_to label on open jobs in sync.
  await supabase
    .from("maintenance_jobs")
    .update({ assigned_to: parsed.data.name.trim() })
    .eq("supplier_id", id);

  revalidatePath("/maintenance");
  return { success: true };
}

export async function deleteSupplier(id: string) {
  await requireRole([...ADMIN_ROLES]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid supplier id" };
  const supabase = createSupabaseServerClient();

  // FK on maintenance_jobs is ON DELETE SET NULL; the free-text
  // assigned_to stays behind as a historical label on those jobs.
  const { error } = await supabase.from("maintenance_suppliers").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// Job assignment
// ──────────────────────────────────────────────────────────

/**
 * Assign (or clear, with null) a preferred supplier on a job.
 * Also mirrors the supplier name into assigned_to so every
 * existing display (list, kanban, drawer, activity) keeps working.
 */
export async function assignSupplierToJob(jobId: string, supplierId: string | null) {
  await requireRole([...ADMIN_ROLES]);
  if (!z.string().uuid().safeParse(jobId).success) return { error: "Invalid job id" };
  if (supplierId !== null && !z.string().uuid().safeParse(supplierId).success) {
    return { error: "Invalid supplier id" };
  }
  const supabase = createSupabaseServerClient();

  let supplierName: string | null = null;
  if (supplierId) {
    const { data: supplier, error: loadErr } = await supabase
      .from("maintenance_suppliers")
      .select("name")
      .eq("id", supplierId)
      .maybeSingle();
    if (loadErr) return { error: loadErr.message };
    if (!supplier) return { error: "Supplier not found" };
    supplierName = supplier.name;
  }

  const { error } = await supabase
    .from("maintenance_jobs")
    .update({
      supplier_id: supplierId,
      assigned_to: supplierName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { success: true, assigned_to: supplierName };
}
