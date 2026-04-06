"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

// ──────────────────────────────────────────────────────────
// Zod Schemas
// ──────────────────────────────────────────────────────────

const CATEGORIES = ["plumbing", "electrical", "structural", "appliance", "pest_control", "cleaning", "decoration", "other"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["open", "in_progress", "pending_parts", "pending_quote", "resolved", "closed"] as const;

const JobBaseSchema = z.object({
  property_id: z.string().uuid(),
  unit_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().nullable().optional(),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  reported_by: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
});

const NewJobSchema = JobBaseSchema;

const UpdateJobSchema = JobBaseSchema.extend({
  status: z.enum(STATUSES).optional(),
  resolved_date: z.string().nullable().optional(),
});

const JobCostSchema = z.object({
  job_id: z.string().uuid(),
  property_id: z.string().uuid(),
  description: z.string().min(1, "Description is required"),
  amount_pounds: z.number().positive("Amount must be positive"),
  date_incurred: z.string(),
  supplier: z.string().nullable().optional(),
  invoice_ref: z.string().nullable().optional(),
});

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

async function recomputeJobTotal(supabase: ReturnType<typeof createSupabaseServerClient>, jobId: string) {
  const { data } = await supabase
    .from("maintenance_costs")
    .select("amount")
    .eq("job_id", jobId);
  const total = (data ?? []).reduce((s, c) => s + (c.amount ?? 0), 0);
  await supabase
    .from("maintenance_jobs")
    .update({ total_cost: total, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

// ──────────────────────────────────────────────────────────
// Job CRUD
// ──────────────────────────────────────────────────────────

export async function createMaintenanceJob(raw: z.infer<typeof NewJobSchema>) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = NewJobSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("maintenance_jobs").insert({
    property_id: d.property_id,
    unit_id: d.unit_id ?? null,
    title: d.title,
    description: d.description ?? null,
    category: d.category,
    priority: d.priority,
    status: "open",
    reported_by: d.reported_by ?? null,
    assigned_to: d.assigned_to ?? null,
    scheduled_date: d.scheduled_date ?? null,
    total_cost: 0,
  });
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMaintenanceJob(
  id: string,
  raw: z.infer<typeof UpdateJobSchema>
) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = UpdateJobSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const supabase = createSupabaseServerClient();

  const updates: Record<string, unknown> = {
    title: d.title,
    description: d.description ?? null,
    category: d.category,
    priority: d.priority,
    reported_by: d.reported_by ?? null,
    assigned_to: d.assigned_to ?? null,
    scheduled_date: d.scheduled_date ?? null,
    updated_at: new Date().toISOString(),
  };

  if (d.status !== undefined) {
    updates.status = d.status;
    if (d.status === "resolved" && !d.resolved_date) {
      updates.resolved_date = new Date().toISOString().split("T")[0];
    }
  }
  if (d.resolved_date !== undefined) updates.resolved_date = d.resolved_date;

  const { error } = await supabase.from("maintenance_jobs").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateJobStatus(jobId: string, newStatus: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "resolved") {
    updates.resolved_date = new Date().toISOString().split("T")[0];
  }

  const { error } = await supabase.from("maintenance_jobs").update(updates).eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMaintenanceJob(jobId: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Delete linked property_costs records first
  const { data: costs } = await supabase
    .from("maintenance_costs")
    .select("property_cost_id")
    .eq("job_id", jobId);
  const ids = (costs ?? []).map((c) => c.property_cost_id).filter(Boolean) as string[];
  if (ids.length > 0) {
    await supabase.from("property_costs").delete().in("id", ids);
  }

  const { error } = await supabase.from("maintenance_jobs").delete().eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  revalidatePath("/profitability");
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// Cost CRUD (auto-syncs to property_costs)
// ──────────────────────────────────────────────────────────

export async function addJobCost(raw: z.infer<typeof JobCostSchema>) {
  await requireRole([...ADMIN_ROLES]);
  const parsed = JobCostSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const amountPence = Math.round(d.amount_pounds * 100);
  const supabase = createSupabaseServerClient();

  // Step 1: Create the property_costs mirror record
  const { data: propCost, error: propCostErr } = await supabase
    .from("property_costs")
    .insert({
      property_id: d.property_id,
      cost_type: "maintenance",
      cost_label: d.description,
      amount: amountPence,
      cost_mode: "one_off",
      date_incurred: d.date_incurred,
      notes: d.supplier ?? null,
      source: "maintenance",
      // source_id set after we have the job_id confirmed — passed directly
      source_id: d.job_id,
    })
    .select("id")
    .single();
  if (propCostErr) return { error: propCostErr.message };

  // Step 2: Create the maintenance_costs record
  const { error: maintCostErr } = await supabase.from("maintenance_costs").insert({
    job_id: d.job_id,
    property_cost_id: propCost.id,
    description: d.description,
    amount: amountPence,
    date_incurred: d.date_incurred,
    supplier: d.supplier ?? null,
    invoice_ref: d.invoice_ref ?? null,
  });
  if (maintCostErr) {
    // Rollback the property_costs insert
    await supabase.from("property_costs").delete().eq("id", propCost.id);
    return { error: maintCostErr.message };
  }

  // Step 3: Recompute the job's total_cost
  await recomputeJobTotal(supabase, d.job_id);

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  revalidatePath(`/profitability/${d.property_id}`);
  revalidatePath("/profitability");
  return { success: true };
}

export async function deleteJobCost(
  costId: string,
  jobId: string,
  propertyId: string
) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Fetch the linked property_cost_id before deleting
  const { data: cost } = await supabase
    .from("maintenance_costs")
    .select("property_cost_id")
    .eq("id", costId)
    .single();

  const { error } = await supabase.from("maintenance_costs").delete().eq("id", costId);
  if (error) return { error: error.message };

  // Delete the mirrored property_costs record
  if (cost?.property_cost_id) {
    await supabase.from("property_costs").delete().eq("id", cost.property_cost_id);
  }

  // Recompute job total
  await recomputeJobTotal(supabase, jobId);

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  revalidatePath(`/profitability/${propertyId}`);
  revalidatePath("/profitability");
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// Photo
// ──────────────────────────────────────────────────────────

export async function deleteJobPhoto(photoId: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("maintenance_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };
  revalidatePath("/maintenance");
  return { success: true };
}
