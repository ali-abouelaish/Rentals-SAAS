"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDpsContext } from "@/lib/dps/context";
import { createDpsTenancy } from "@/lib/dps/deposits";
import { buildCreateTenancyPayload } from "@/lib/dps/mapDeposit";
import { isDpsCreated } from "@/lib/dps/statusMap";
import type { DpsFieldError } from "@/lib/dps/parse";
import {
  registerDpsDepositSchema,
  type RegisterDpsDepositInput,
  type DpsDepositStatus,
} from "../domain/deposit-types";

export type RegisterDpsDepositResult = {
  ok: boolean;
  depositRowId?: string;
  dpsDepositId?: string;
  status?: DpsDepositStatus;
  error?: string;
  fieldErrors?: DpsFieldError[];
  alreadySubmitted?: boolean;
};

/**
 * Register a deposit with DPS (Create Tenancy). Idempotent like the TDS
 * flow: once a row carries a DPS depositId the tenancy exists at DPS and a
 * re-run returns it untouched (re-posting would create a duplicate — DPS has
 * no idempotency key). Failed/errored attempts without a depositId fall
 * through to a fresh POST.
 */
export async function registerDpsDeposit(
  input: RegisterDpsDepositInput
): Promise<RegisterDpsDepositResult> {
  const parsed = registerDpsDepositSchema.parse(input);
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // 1. Load the contract (RLS confirms tenant ownership) and assert scheme.
  const { data: contract, error: contractErr } = await supabase
    .from("property_contracts")
    .select("id, tenant_id, deposit, deposit_scheme")
    .eq("id", parsed.contractId)
    .single();
  if (contractErr || !contract) throw new Error("Contract not found.");
  if (contract.deposit_scheme !== "dps") {
    throw new Error("Contract deposit scheme is not set to DPS.");
  }

  const ctx = await getDpsContext(profile.tenant_id);
  const admin = ctx.admin;

  // 2. If this contract already has a DPS depositId, the tenancy exists at
  //    DPS — never re-post. Pre-acceptance failures leave deposit_id null and
  //    fall through to the retry below.
  const { data: existing } = await admin
    .from("dps_deposits")
    .select("id, deposit_id, status")
    .eq("contract_id", contract.id)
    .maybeSingle();
  if (existing?.deposit_id) {
    const status = existing.status as DpsDepositStatus;
    return {
      ok: isDpsCreated(status),
      depositRowId: existing.id as string,
      dpsDepositId: existing.deposit_id as string,
      status,
      alreadySubmitted: true,
      error: isDpsCreated(status)
        ? undefined
        : "This tenancy already exists at DPS. Resolve it in the DPS portal rather than re-submitting.",
    };
  }

  // 3. Build the payload (no secrets in it) and upsert the row at 'submitted'.
  const payload = buildCreateTenancyPayload(parsed, ctx.agentLandlordId);

  const { data: upserted, error: upsertErr } = await admin
    .from("dps_deposits")
    .upsert(
      {
        tenant_id: profile.tenant_id,
        contract_id: contract.id,
        status: "submitted",
        deposit_amount_pence: Math.round(parsed.tenancy.depositAmount * 100),
        request_payload: payload,
        deposit_id: null,
        allocation_reference: null,
        payment_reference: null,
        request_id: null,
        errors: null,
        last_error: null,
        created_by: profile.id,
      },
      { onConflict: "contract_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();
  if (upsertErr || !upserted) {
    throw new Error(upsertErr?.message ?? "Failed to create the DPS deposit row.");
  }
  const depositRowId = upserted.id as string;

  // 4. POST tenancy/create. Success is synchronous — persist the depositId and
  //    mirror it onto the contract; failure records the field errors.
  const result = await createDpsTenancy(ctx, payload, depositRowId);

  let status: DpsDepositStatus;
  if (result.ok && result.depositId) {
    status = "created";
    await admin
      .from("dps_deposits")
      .update({
        status,
        deposit_id: result.depositId,
        request_id: result.requestId,
        errors: null,
        last_error: null,
      })
      .eq("id", depositRowId);
    await admin
      .from("property_contracts")
      .update({ deposit_scheme_ref: result.depositId })
      .eq("id", contract.id);
  } else {
    // 400 = DPS rejected the data (failed); anything else is transport (error).
    status = result.status === 400 ? "failed" : "error";
    await admin
      .from("dps_deposits")
      .update({
        status,
        request_id: result.requestId,
        errors: result.fieldErrors.length ? result.fieldErrors : null,
        last_error: result.error ?? "Create tenancy was rejected.",
      })
      .eq("id", depositRowId);
  }

  // 5. Activity log (best-effort).
  await admin
    .from("activity_log")
    .insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: "dps_deposit_registered",
      entity_type: "dps_deposit",
      entity_id: depositRowId,
      metadata: { dps_deposit_id: result.depositId, request_id: result.requestId, ok: result.ok },
    })
    .then(undefined, () => {});

  revalidatePath("/deposits");
  revalidatePath("/contracts");

  return {
    ok: result.ok,
    depositRowId,
    dpsDepositId: result.depositId ?? undefined,
    status,
    error: result.ok ? undefined : result.error ?? "Create tenancy was rejected.",
    fieldErrors: result.fieldErrors.length ? result.fieldErrors : undefined,
  };
}
