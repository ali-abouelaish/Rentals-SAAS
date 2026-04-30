"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadOwnedRequest(id: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);
  const { data, error } = await supabase
    .from("tenant_communication_requests")
    .select("id, tenant_id, pm_tenant_id, request_type, payload, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Request not found");
  if (data.tenant_id !== profile.tenant_id) throw new Error("Request not found");
  return { data, profile };
}

export async function approveEmailChange(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const { data, profile } = await loadOwnedRequest(id);
  if (data.request_type !== "email_change") throw new Error("Wrong request type");
  if (data.status !== "pending") return;

  const requested = String((data.payload as Record<string, unknown>)?.requested_email ?? "")
    .trim()
    .toLowerCase();
  if (!requested || !EMAIL_RE.test(requested)) {
    throw new Error("Stored requested email is invalid.");
  }

  const admin = createSupabaseAdminClient();

  // Update the renter's email + reset bounce/complaint state — the new
  // address has not yet had a chance to bounce, and continuing to suppress
  // would defeat the whole approval.
  const { error: pmErr } = await admin
    .from("pm_tenants")
    .update({ email: requested, email_status: "active" })
    .eq("id", data.pm_tenant_id);
  if (pmErr) throw new Error(pmErr.message);

  const { error } = await admin
    .from("tenant_communication_requests")
    .update({
      status: "completed",
      resolution_notes: `Email updated to ${requested}.`,
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
}

export async function completeRequest(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("resolution_notes") ?? "").trim();
  const { data, profile } = await loadOwnedRequest(id);
  if (data.status !== "pending") return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenant_communication_requests")
    .update({
      status: "completed",
      resolution_notes: notes || null,
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
}

export async function rejectRequest(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("resolution_notes") ?? "").trim();
  const { data, profile } = await loadOwnedRequest(id);
  if (data.status !== "pending") return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenant_communication_requests")
    .update({
      status: "rejected",
      resolution_notes: notes || null,
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
}
