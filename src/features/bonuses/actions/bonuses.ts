"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bonusSchema, type BonusFormValues } from "../domain/schemas";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";

export async function submitBonus(values: BonusFormValues) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const payload = bonusSchema.parse(values);
  const agentId = payload.agent_id ?? profile.id;
  const { data: bonusCode, error: bonusCodeError } = await supabase.rpc(
    "next_bonus_code",
    { p_tenant_id: profile.tenant_id }
  );
  if (bonusCodeError) throw new Error(bonusCodeError.message);

  const { data, error } = await supabase
    .from("bonuses")
    .insert({
      tenant_id: profile.tenant_id,
      code: bonusCode,
      landlord_id: payload.landlord_id,
      bonus_date: payload.bonus_date,
      client_name: payload.client_name,
      property_address: payload.property_address,
      amount_owed: payload.amount_owed,
      agent_id: agentId,
      payout_mode: payload.payout_mode,
      notes: payload.notes ?? null,
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

export async function updateBonus(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const bonusId = String(formData.get("bonus_id") ?? "");
  if (!bonusId) throw new Error("Missing bonus id.");

  const payload = bonusSchema.parse({
    bonus_date: String(formData.get("bonus_date") ?? ""),
    client_name: String(formData.get("client_name") ?? ""),
    property_address: String(formData.get("property_address") ?? ""),
    landlord_id: String(formData.get("landlord_id") ?? ""),
    agent_id: formData.get("agent_id") ?? undefined,
    amount_owed: Number(formData.get("amount_owed") ?? 0),
    payout_mode: String(formData.get("payout_mode") ?? "standard"),
    notes: String(formData.get("notes") ?? "")
  });

  const nextAgentId =
    profile.role.toLowerCase() === "admin" ? payload.agent_id ?? profile.id : profile.id;

  if (profile.role.toLowerCase() !== "admin") {
    const { data: bonus } = await supabase
      .from("bonuses")
      .select("status, agent_id")
      .eq("id", bonusId)
      .single();
    if (!bonus || bonus.agent_id !== profile.id || bonus.status !== "pending") {
      throw new Error("You cannot edit this bonus.");
    }
  }

  const { error } = await supabase
    .from("bonuses")
    .update({
      bonus_date: payload.bonus_date,
      client_name: payload.client_name,
      property_address: payload.property_address,
      landlord_id: payload.landlord_id,
      agent_id: nextAgentId,
      amount_owed: payload.amount_owed,
      payout_mode: payload.payout_mode,
      notes: payload.notes ?? null
    })
    .eq("id", bonusId);
  if (error) throw new Error(error.message);

  revalidatePath("/bonuses");
  revalidatePath(`/bonuses/${bonusId}`);
}

async function deleteBonusById(bonusId: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();

  if (profile.role.toLowerCase() !== "admin") {
    const { data: bonus } = await supabase
      .from("bonuses")
      .select("status, agent_id")
      .eq("id", bonusId)
      .single();
    if (!bonus || bonus.agent_id !== profile.id || bonus.status !== "pending") {
      throw new Error("You cannot delete this bonus.");
    }
  }

  const { data: links, error: linkError } = await supabase
    .from("invoice_bonus_links")
    .select("id")
    .eq("bonus_id", bonusId)
    .limit(1);
  if (linkError) throw new Error(linkError.message);
  if (links && links.length > 0) {
    throw new Error("Cannot delete a bonus linked to an invoice.");
  }

  const { error } = await supabase.from("bonuses").delete().eq("id", bonusId);
  if (error) throw new Error(error.message);

  revalidatePath("/bonuses");
}

export async function deleteBonusAction(
  _prevState: { ok?: boolean; error?: string },
  formData: FormData
) {
  try {
    const bonusId = String(formData.get("bonus_id") ?? "");
    if (!bonusId) return { error: "Missing bonus id." };
    await deleteBonusById(bonusId);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    return { error: "Unable to delete bonus." };
  }
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
