"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bonusSchema, type BonusFormValues } from "../domain/schemas";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";

export async function submitBonus(values: BonusFormValues) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const payload = bonusSchema.parse(values);

  const { data, error } = await supabase
    .from("bonuses")
    .insert({
      tenant_id: profile.tenant_id,
      landlord_id: payload.landlord_id,
      amount_owed: payload.amount_owed,
      agent_id: profile.id,
      payout_mode: payload.payout_mode,
      status: "pending",
      invoice_pending: true
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "bonus_submitted",
    entity_type: "bonus",
    entity_id: data.id,
    metadata: { amount: data.amount_owed }
  });

  revalidatePath("/bonuses");
  return data;
}

export async function approveBonus(bonusId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole(["admin"]);

  const { data: bonus, error } = await supabase
    .from("bonuses")
    .select("*")
    .eq("id", bonusId)
    .single();
  if (error) throw new Error(error.message);

  const agentEarning =
    bonus.payout_mode === "full" ? bonus.amount_owed : bonus.amount_owed * 0.5;

  await supabase
    .from("bonuses")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: profile.id
    })
    .eq("id", bonusId);

  await supabase.from("ledger_entries").insert({
    tenant_id: profile.tenant_id,
    type: "bonus",
    reference_type: "bonus",
    reference_id: bonus.id,
    amount_gbp: bonus.amount_owed,
    agent_earning_gbp: agentEarning,
    agent_id: bonus.agent_id
  });

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "bonus_approved",
    entity_type: "bonus",
    entity_id: bonus.id,
    metadata: { amount: bonus.amount_owed }
  });

  revalidatePath(`/bonuses`);
  return { ok: true };
}
