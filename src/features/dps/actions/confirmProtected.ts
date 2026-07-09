"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const confirmSchema = z.object({ depositRowId: z.string().uuid() });

export type ConfirmDpsProtectedResult = { ok: boolean; error?: string };

/**
 * Record that a DPS deposit is protected. DPS exposes no status/read endpoint,
 * so protection (which happens after the deposit payment clears) can only be
 * confirmed manually — an admin checks the agency's DPS portal account and
 * records it here. Mirrors deposit_protected_date onto the contract.
 */
export async function confirmDpsDepositProtected(input: {
  depositRowId: string;
}): Promise<ConfirmDpsProtectedResult> {
  const parsed = confirmSchema.parse(input);
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: row, error: rowErr } = await admin
    .from("dps_deposits")
    .select("id, status, contract_id, deposit_id")
    .eq("id", parsed.depositRowId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (rowErr || !row) return { ok: false, error: "Deposit not found." };
  if (row.status === "protected") return { ok: true };
  if (row.status !== "created" && row.status !== "marked_for_transfer") {
    return { ok: false, error: "Only a registered deposit can be confirmed as protected." };
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("dps_deposits")
    .update({
      status: "protected",
      protected_confirmed_at: now,
      protected_confirmed_by: profile.id,
      last_error: null,
    })
    .eq("id", row.id);
  if (updateErr) return { ok: false, error: updateErr.message };

  await admin
    .from("property_contracts")
    .update({ deposit_protected_date: now.slice(0, 10) })
    .eq("id", row.contract_id);

  await admin
    .from("activity_log")
    .insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: "dps_deposit_protected_confirmed",
      entity_type: "dps_deposit",
      entity_id: row.id,
      metadata: { dps_deposit_id: row.deposit_id },
    })
    .then(undefined, () => {});

  revalidatePath("/deposits");
  revalidatePath("/contracts");
  return { ok: true };
}
