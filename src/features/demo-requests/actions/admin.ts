"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logPlatformAudit } from "@/lib/audit/platformAudit";
import { demoNotesSchema } from "../domain/schemas";
import { DEMO_REQUEST_STATUSES, STATUS_LABELS } from "../domain/types";

// Platform-side writes. Service role behind requireSuperAdmin() — the table has no RLS policy at
// all by design (see the migration header).

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().uuid();
const statusSchema = z.enum(DEMO_REQUEST_STATUSES);

function revalidateRequest(id: string) {
  revalidatePath("/admin/demo-requests");
  revalidatePath(`/admin/demo-requests/${id}`);
  revalidatePath("/admin");
}

export async function updateDemoRequestStatus(id: string, status: string): Promise<AdminActionResult> {
  await requireSuperAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid request" };
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Choose a status from the list" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("demo_requests").update({ status: parsed.data }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save the status. Try again." };
  revalidateRequest(id);
  return { ok: true };
}

export async function saveDemoRequestNotes(id: string, input: unknown): Promise<AdminActionResult> {
  await requireSuperAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid request" };
  const parsed = demoNotesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid notes" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("demo_requests")
    .update({ admin_notes: parsed.data.notes || null })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't save the notes. Try again." };
  revalidateRequest(id);
  return { ok: true };
}

/** Permanently removes the request (they're kept until someone does this). */
export async function deleteDemoRequest(id: string): Promise<AdminActionResult> {
  const actor = await requireSuperAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid request" };

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("demo_requests").select("company, status").eq("id", id).maybeSingle();
  const { error } = await admin.from("demo_requests").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the request. Try again." };

  // No personal details in the trail: the company and the status it had are enough to recognise it.
  await logPlatformAudit({
    actor,
    category: "system",
    action: "demo_request.deleted",
    summary: row
      ? `Deleted a demo request from ${row.company} (${STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status})`
      : "Deleted a demo request",
    entityType: "demo_request",
    entityId: id,
  });
  revalidatePath("/admin/demo-requests");
  revalidatePath("/admin");
  return { ok: true };
}
