// DPS deposit-lifecycle calls with per-call dps_api_log rows, mirroring
// lib/tds/deposits.ts. The HTTP itself lives in apiClient.ts; these wrappers
// add audit logging keyed to the tenant + local deposit row.

import {
  DPS_CREATE_TENANCY_PATH,
  DPS_MARK_FOR_BANK_TRANSFER_PATH,
} from "./config";
import type { DpsContext } from "./context";
import {
  createTenancy,
  markForBankTransfer,
  type DpsCreateTenancyResult,
  type DpsMarkForBankTransferResult,
} from "./apiClient";

async function logCall(
  ctx: DpsContext,
  args: {
    path: string;
    status: number;
    ok: boolean;
    requestId: string | null;
    error: string | null;
    depositRowId?: string;
  }
) {
  await ctx.admin
    .from("dps_api_log")
    .insert({
      tenant_id: ctx.tenantId,
      deposit_id: args.depositRowId ?? null,
      method: "POST",
      path: args.path,
      status_code: args.status || null,
      ok: args.ok,
      request_id: args.requestId,
      error: args.error,
    })
    .then(undefined, () => {});
}

/** POST tenancy/create + one dps_api_log row. Never throws on rejection. */
export async function createDpsTenancy(
  ctx: DpsContext,
  payload: Record<string, unknown>,
  depositRowId?: string
): Promise<DpsCreateTenancyResult> {
  const result = await createTenancy(ctx.tenantId, ctx.creds, payload);
  await logCall(ctx, {
    path: DPS_CREATE_TENANCY_PATH,
    status: result.status,
    ok: result.ok,
    requestId: result.requestId,
    error: result.error,
    depositRowId,
  });
  return result;
}

/** POST tenancy/MarkForBankTransfer + one dps_api_log row. Never throws on rejection. */
export async function markDpsForBankTransfer(
  ctx: DpsContext,
  args: { depositId: string; allocationReference: string },
  depositRowId?: string
): Promise<DpsMarkForBankTransferResult> {
  const result = await markForBankTransfer(ctx.tenantId, ctx.creds, args);
  await logCall(ctx, {
    path: DPS_MARK_FOR_BANK_TRANSFER_PATH,
    status: result.status,
    ok: result.ok,
    requestId: result.requestId,
    error: result.error,
    depositRowId,
  });
  return result;
}
