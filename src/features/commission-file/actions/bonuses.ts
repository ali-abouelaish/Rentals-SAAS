"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";

export async function markBonusPaid(bonusId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);

  const { data: bonus, error } = await supabase
    .from("bonuses")
    .select("id, agent_id, amount_owed")
    .eq("id", bonusId)
    .single();
  if (error) throw new Error(error.message);

  const { error: updateError } = await supabase
    .from("bonuses")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by_user_id: profile.id
    })
    .eq("id", bonusId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "bonus_paid",
    entity_type: "bonus",
    entity_id: bonus.id,
    metadata: { amount: bonus.amount_owed }
  });

  revalidatePath(`/admin/agents/${bonus.agent_id}/commission`);
}
