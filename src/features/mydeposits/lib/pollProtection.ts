// Shared polling logic for one protection row, used by both the manual
// "Sync now" action and the cron. Reads the remote deposit, maps its status,
// and writes back contract deposit fields once protected.

import type { MdContext } from "@/lib/mydeposits/apiClient";
import { MdApiError } from "@/lib/mydeposits/apiClient";
import { getDeposit, getPayment } from "@/lib/mydeposits/realityStone";
import { mapRemoteDepositStatus, shouldAdvanceStatus } from "@/lib/mydeposits/statusMap";
import type { MdProtection } from "../domain/types";

export type PollResult = "advanced" | "unchanged" | "skipped" | "error";

/**
 * Poll a single protection. ctx carries the per-tenant token + admin client.
 * Records last_error without flipping status to 'error' unless the failure is
 * a hard auth error (the connection needs re-authing).
 */
export async function pollOneProtection(ctx: MdContext, row: MdProtection): Promise<PollResult> {
  const admin = ctx.admin;
  const nowIso = new Date().toISOString();

  if (!row.remote_deposit_id) {
    // Nothing minted remotely yet — just stamp the poll time.
    await admin
      .from("mydeposits_protections")
      .update({ last_polled_at: nowIso })
      .eq("id", row.id);
    return "skipped";
  }

  try {
    const deposit = await getDeposit(ctx, row.remote_deposit_id, row.id);
    const rawStatus = deposit.depositStatus ?? deposit.status ?? null;
    const mapped = mapRemoteDepositStatus(rawStatus);
    const certificateUrl =
      typeof deposit.certificateUrl === "string" ? deposit.certificateUrl : row.certificate_url;

    // While awaiting payment, also refresh the payment so the UI reflects it.
    if (row.status === "awaiting_payment" && row.remote_payment_id) {
      await getPayment(ctx, row.remote_payment_id, row.id).catch(() => {});
    }

    const update: Record<string, unknown> = {
      last_polled_at: nowIso,
      last_error: null,
      remote_deposit_status: rawStatus,
      certificate_url: certificateUrl,
    };

    let advanced = false;
    if (mapped && shouldAdvanceStatus(row.status, mapped)) {
      update.status = mapped;
      advanced = true;

      // On first transition to protected, write the protection back onto the
      // contract so the existing deposit tracking UI reflects it.
      if (mapped === "protected") {
        await admin
          .from("property_contracts")
          .update({
            deposit_scheme_ref: row.remote_deposit_id,
            deposit_protected_date: nowIso.slice(0, 10),
          })
          .eq("id", row.contract_id);
      }
    }

    await admin.from("mydeposits_protections").update(update).eq("id", row.id);
    return advanced ? "advanced" : "unchanged";
  } catch (err) {
    const isAuth = err instanceof MdApiError && err.isAuthError;
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    await admin
      .from("mydeposits_protections")
      .update({
        last_polled_at: nowIso,
        last_error: message,
        ...(isAuth ? { status: "error" } : {}),
      })
      .eq("id", row.id);
    return "error";
  }
}
