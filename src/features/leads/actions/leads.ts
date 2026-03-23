"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile, requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { updateLeadStatusSchema, assignLeadSchema } from "../domain/schemas";
import type { LeadStatus } from "../domain/types";

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();
  const { status: validated } = updateLeadStatusSchema.parse({ status });

  const { error } = await supabase
    .from("leads")
    .update({ status: validated, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function assignLead(leadId: string, assignedTo: string | null) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);
  const { assigned_to } = assignLeadSchema.parse({ assigned_to: assignedTo });

  const { error } = await supabase
    .from("leads")
    .update({ assigned_to, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${leadId}`);
}

export async function deleteLead(leadId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  redirect("/leads");
}
