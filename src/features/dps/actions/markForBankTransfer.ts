"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getDpsContext } from "@/lib/dps/context";
import { markDpsForBankTransfer } from "@/lib/dps/deposits";
import {
  markDpsForBankTransferSchema,
  type MarkDpsForBankTransferInput,
} from "../domain/deposit-types";

export type MarkDpsForBankTransferResult = {
  ok: boolean;
  paymentReference?: string;
  error?: string;
};

/**
 * Move a created DPS tenancy from "Awaiting deposit payment" to "Awaiting bank
 * transfer". DPS returns a paymentReference; the agency's bank transfer must
 * carry it so DPS can auto-allocate the money (one transfer can cover several
 * deposits marked with the same allocation reference).
 */
export async function markDpsDepositForBankTransfer(
  input: MarkDpsForBankTransferInput
): Promise<MarkDpsForBankTransferResult> {
  const parsed = markDpsForBankTransferSchema.parse(input);
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getDpsContext(profile.tenant_id);
  const admin = ctx.admin;

  // Tenant scoping is explicit — dps_deposits is read via the admin client here
  // so the update below can share it, but the row must belong to this tenant.
  const { data: row, error: rowErr } = await admin
    .from("dps_deposits")
    .select("id, status, deposit_id, payment_reference")
    .eq("id", parsed.depositRowId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (rowErr || !row) return { ok: false, error: "Deposit not found." };

  if (row.status === "marked_for_transfer" && row.payment_reference) {
    return { ok: true, paymentReference: row.payment_reference as string };
  }
  if (row.status !== "created" || !row.deposit_id) {
    return {
      ok: false,
      error:
        "Only a registered deposit that is awaiting payment can be marked for bank transfer.",
    };
  }

  const result = await markDpsForBankTransfer(
    ctx,
    { depositId: row.deposit_id as string, allocationReference: parsed.allocationReference },
    row.id as string
  );

  if (!result.ok || !result.paymentReference) {
    await admin
      .from("dps_deposits")
      .update({ last_error: result.error ?? "MarkForBankTransfer was rejected." })
      .eq("id", row.id);
    return { ok: false, error: result.error ?? "MarkForBankTransfer was rejected." };
  }

  await admin
    .from("dps_deposits")
    .update({
      status: "marked_for_transfer",
      allocation_reference: parsed.allocationReference,
      payment_reference: result.paymentReference,
      request_id: result.requestId,
      last_error: null,
    })
    .eq("id", row.id);

  await admin
    .from("activity_log")
    .insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: "dps_deposit_marked_for_transfer",
      entity_type: "dps_deposit",
      entity_id: row.id,
      metadata: {
        allocation_reference: parsed.allocationReference,
        payment_reference: result.paymentReference,
      },
    })
    .then(undefined, () => {});

  revalidatePath("/deposits");
  return { ok: true, paymentReference: result.paymentReference };
}
