"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";

export async function createAgentPayout(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);
  const agentId = String(formData.get("agent_id") ?? "");
  const amountRaw = String(formData.get("amount_gbp") ?? "");
  const payoutDate = String(formData.get("payout_date") ?? "");
  const notes = String(formData.get("notes") ?? "");

  if (!agentId) throw new Error("Missing agent.");

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid payout amount.");
  }

  const { error } = await supabase.from("agent_payouts").insert({
    tenant_id: profile.tenant_id,
    agent_id: agentId,
    payout_date: payoutDate || new Date().toISOString().slice(0, 10),
    amount_gbp: amount,
    notes: notes || null,
    created_by_user_id: profile.id
  });
  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "agent_payout_created",
    entity_type: "agent_payout",
    entity_id: null,
    metadata: { agent_id: agentId, amount }
  });

  revalidatePath(`/admin/agents/${agentId}/commission`);
}
