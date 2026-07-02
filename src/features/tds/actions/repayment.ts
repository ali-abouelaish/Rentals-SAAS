"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getTdsContext } from "@/lib/tds/context";
import { raiseRepaymentRequest } from "@/lib/tds/deposits";
import { raiseTdsRepaymentSchema, type RaiseTdsRepaymentInput } from "../domain/deposit-types";

export type RaiseTdsRepaymentResult = { ok: boolean; error?: string };

// The repayment endpoint's spec is explicit that dates are dd/mm/yyyy, so this
// stays fixed regardless of the CreateDeposit date-separator experiment.
function toSlashDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

const round2 = (n: number) => Number(n.toFixed(2));

/**
 * Raise a repayment request against a protected TDS deposit. The agent breakdown
 * is validated to sum to the agent total on both the client and here (server).
 */
export async function raiseTdsRepayment(
  input: RaiseTdsRepaymentInput
): Promise<RaiseTdsRepaymentResult> {
  const parsed = raiseTdsRepaymentSchema.parse(input);
  const profile = await requireRole([...ADMIN_ROLES]);
  const ctx = await getTdsContext(profile.tenant_id);
  const admin = ctx.admin;

  // Load the deposit row (admin, scoped to tenant). Need its DAN.
  const { data: deposit } = await admin
    .from("tds_deposits")
    .select("id, dan, status")
    .eq("id", parsed.depositId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!deposit) return { ok: false, error: "Deposit not found." };
  if (!deposit.dan) {
    return {
      ok: false,
      error: "This deposit has no DAN yet — it must be protected before a repayment can be requested.",
    };
  }

  const body: Record<string, unknown> = {
    api_key: ctx.apiKey,
    member_id: ctx.memberId,
    branch_id: ctx.branchId,
    dan: deposit.dan,
    tenancy_end_date: toSlashDate(parsed.tenancyEndDate),
    tenant_repayment: round2(parsed.tenantRepayment),
    tenant_repayment_type: parsed.tenantRepaymentType,
    agent_repayment: {
      total: round2(parsed.agent.total),
      cleaning: round2(parsed.agent.cleaning),
      rent_arrears: round2(parsed.agent.rentArrears),
      damage: round2(parsed.agent.damage),
      redecoration: round2(parsed.agent.redecoration),
      gardening: round2(parsed.agent.gardening),
      other: round2(parsed.agent.other),
      ...(parsed.agent.otherText ? { other_text: parsed.agent.otherText } : {}),
    },
  };

  const result = await raiseRepaymentRequest(ctx, body, deposit.id as string);

  // Persist the request with the api_key stripped from the stored copy.
  const { api_key: _omit, ...storedBody } = body;
  await admin
    .from("tds_deposits")
    .update({
      repayment_request: storedBody,
      repayment_requested_at: new Date().toISOString(),
      repayment_requested_by: profile.id,
      ...(result.success ? {} : { last_error: result.error }),
    })
    .eq("id", deposit.id);

  await admin
    .from("activity_log")
    .insert({
      tenant_id: profile.tenant_id,
      actor_user_id: profile.id,
      action: "tds_repayment_requested",
      entity_type: "tds_deposit",
      entity_id: deposit.id,
      metadata: { ok: result.success, dan: deposit.dan },
    })
    .then(undefined, () => {});

  revalidatePath("/deposits");
  return { ok: result.success, error: result.success ? undefined : result.error ?? undefined };
}
