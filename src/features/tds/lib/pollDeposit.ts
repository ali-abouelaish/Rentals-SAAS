// Shared polling logic for one TDS deposit row, used by both a manual re-check
// and the cron. Calls CreateDepositStatus and, once `created`, writes the DAN
// back onto the contract's deposit fields — mirrors mydeposits' pollOneProtection.

import type { TdsContext } from "@/lib/tds/context";
import { TdsApiError, getCreateDepositStatus } from "@/lib/tds/deposits";
import type { TdsDeposit } from "../domain/deposit-types";

export type TdsPollResult = "advanced" | "unchanged" | "skipped" | "error";

/**
 * Poll a single deposit. ctx carries the per-tenant creds + admin client.
 * A hard auth error (401/403) flips the row to 'error'; transport/parse failures
 * just record last_error and leave the status for the next run.
 */
export async function pollOneTdsDeposit(ctx: TdsContext, row: TdsDeposit): Promise<TdsPollResult> {
  const admin = ctx.admin;
  const nowIso = new Date().toISOString();

  if (!row.batch_id) {
    // Submitted but no batch id (e.g. CreateDeposit was rejected) — nothing to poll.
    await admin.from("tds_deposits").update({ last_polled_at: nowIso }).eq("id", row.id);
    return "skipped";
  }

  try {
    const remote = await getCreateDepositStatus(ctx, row.batch_id, row.id);

    const update: Record<string, unknown> = {
      last_polled_at: nowIso,
      last_error: null,
      status_response: {
        success: remote.success,
        status: remote.status,
        dan: remote.dan,
        branch_id: remote.branchId,
      },
      warnings: remote.warnings,
      errors: remote.errors,
    };

    let advanced = false;
    if (remote.status === "created") {
      update.status = "created";
      update.dan = remote.dan;
      advanced = row.status !== "created";
      // Mirror the DAN onto the contract so the deposit-tracking UI reflects it.
      if (remote.dan) {
        await admin
          .from("property_contracts")
          .update({
            deposit_scheme_ref: remote.dan,
            deposit_protected_date: nowIso.slice(0, 10),
          })
          .eq("id", row.contract_id);
      }
    } else if (remote.status === "failed") {
      update.status = "failed";
      update.last_error = remote.error ?? "TDS reported the deposit creation failed.";
      advanced = row.status !== "failed";
    } else if (remote.status === "pending") {
      if (row.status !== "pending") {
        update.status = "pending";
        advanced = true;
      }
    }

    await admin.from("tds_deposits").update(update).eq("id", row.id);
    return advanced ? "advanced" : "unchanged";
  } catch (err) {
    const isAuth = err instanceof TdsApiError && err.isAuthError;
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    await admin
      .from("tds_deposits")
      .update({
        last_polled_at: nowIso,
        last_error: message,
        ...(isAuth ? { status: "error" } : {}),
      })
      .eq("id", row.id);
    return "error";
  }
}
