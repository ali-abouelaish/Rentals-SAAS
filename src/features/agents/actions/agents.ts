"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { agentUpdateSchema, type AgentUpdateValues } from "../domain/schemas";
import { requireRole } from "@/lib/auth/requireRole";

export async function updateAgentCommission(userId: string, values: AgentUpdateValues) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const payload = agentUpdateSchema.parse(values);

  const { error } = await supabase
    .from("agent_profiles")
    .update({
      commission_percent: payload.commission_percent,
      marketing_fee: payload.marketing_fee
    })
    .eq("user_id", userId)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/agents/${userId}`);
  return { ok: true };
}
