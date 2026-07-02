"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTdsContext } from "@/lib/tds/context";
import { createTdsDeposit } from "@/lib/tds/deposits";
import { buildCreateDepositPayload, stripApiKey } from "@/lib/tds/mapDeposit";
import {
  registerTdsDepositSchema,
  type RegisterTdsDepositInput,
  type TdsDepositStatus,
} from "../domain/deposit-types";

export type RegisterTdsDepositResult = {
  ok: boolean;
  depositId?: string;
  status?: TdsDepositStatus;
  error?: string;
  alreadySubmitted?: boolean;
};

/**
 * Register a deposit with TDS Custodial. Idempotent/resumable like mydeposits'
 * secureDeposit: the CreateDeposit POST is guarded on the absence of batch_id,
 * so a re-run after a mid-flow failure re-posts rather than duplicating, and a
 * row that has already been submitted is returned untouched.
 */
export async function registerTdsDeposit(
  input: RegisterTdsDepositInput
): Promise<RegisterTdsDepositResult> {
  const parsed = registerTdsDepositSchema.parse(input);
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // 1. Load the contract (RLS confirms tenant ownership) and assert scheme.
  const { data: contract, error: contractErr } = await supabase
    .from("property_contracts")
    .select("id, tenant_id, deposit, deposit_scheme")
    .eq("id", parsed.contractId)
    .single();
  if (contractErr || !contract) throw new Error("Contract not found.");
  if (contract.deposit_scheme !== "tds") {
    throw new Error("Contract deposit scheme is not set to TDS.");
  }

  const ctx = await getTdsContext(profile.tenant_id);
  const admin = ctx.admin;

  // 2. If a deposit for this contract already has a batch id, it has been
  //    accepted onto the TDS processing queue — don't re-post (that would
  //    duplicate it). A pre-queue rejection leaves batch_id null, so the common
  //    "fix the data and retry" case falls through to the upsert/POST below.
  const { data: existing } = await admin
    .from("tds_deposits")
    .select("id, batch_id, status")
    .eq("contract_id", contract.id)
    .maybeSingle();
  if (existing?.batch_id) {
    const status = existing.status as TdsDepositStatus;
    if (status === "failed" || status === "error") {
      return {
        ok: false,
        depositId: existing.id as string,
        status,
        error:
          "This deposit was already submitted to TDS and did not complete. Resolve it in the TDS portal rather than re-submitting (that would create a duplicate).",
      };
    }
    return {
      ok: true,
      depositId: existing.id as string,
      status,
      alreadySubmitted: true,
    };
  }

  // 3. Build the payload and upsert the deposit row at 'submitted'
  //    (api_key stripped before it is persisted).
  const payload = buildCreateDepositPayload(parsed, {
    memberId: ctx.memberId,
    branchId: ctx.branchId,
    apiKey: ctx.apiKey,
    region: ctx.region,
    schemeType: ctx.schemeType,
  });

  const { data: upserted, error: upsertErr } = await admin
    .from("tds_deposits")
    .upsert(
      {
        tenant_id: profile.tenant_id,
        contract_id: contract.id,
        status: "submitted",
        region: ctx.region,
        scheme_type: ctx.schemeType,
        deposit_amount_pence: Math.round(parsed.tenancy.depositAmount * 100),
        request_payload: stripApiKey(payload),
        batch_id: null,
        dan: null,
        errors: null,
        warnings: null,
        last_error: null,
        created_by: profile.id,
      },
      { onConflict: "contract_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();
  if (upsertErr || !upserted) {
    throw new Error(upsertErr?.message ?? "Failed to create the TDS deposit row.");
  }
  const depositId = upserted.id as string;

  // 4. POST CreateDeposit. Persist batch_id + pending, or failed + error.
  const result = await createTdsDeposit(ctx, payload, depositId);

  let status: TdsDepositStatus;
  if (result.success && result.batchId) {
    status = "pending";
    await admin
      .from("tds_deposits")
      .update({ status, batch_id: result.batchId, last_error: null })
      .eq("id", depositId);
  } else {
    status = "failed";
    await admin
      .from("tds_deposits")
      .update({ status, last_error: result.error ?? "CreateDeposit was rejected." })
      .eq("id", depositId);
  }

  // 5. Activity log (best-effort).
  await admin
    .from("activity_log")
    .insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: "tds_deposit_registered",
      entity_type: "tds_deposit",
      entity_id: depositId,
      metadata: { batch_id: result.batchId, ok: result.success },
    })
    .then(undefined, () => {});

  revalidatePath("/deposits");
  revalidatePath("/contracts");

  return {
    ok: result.success,
    depositId,
    status,
    error: result.success ? undefined : result.error ?? "CreateDeposit was rejected.",
  };
}
