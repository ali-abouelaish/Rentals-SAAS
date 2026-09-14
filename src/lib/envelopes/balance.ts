import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EMPTY_BALANCE,
  MONTHLY_ALLOWANCE,
  type EnvelopeBalance,
} from "./packs";
import { currentPeriod, projectBalance } from "./period";

// The period and projection rules live in ./period.ts, dependency-free so they
// can be unit-tested. Re-exported so call sites have one import.
export { currentPeriod, projectBalance };

export type ConsumeResult =
  | { ok: true; source: "allowance" | "topup"; remaining: number }
  | { ok: false; reason: "out_of_envelopes"; remaining: 0 }
  | { ok: false; reason: "error"; error: string; remaining: number };

/**
 * Spend one envelope.
 *
 * Delegates to the `consume_envelope` RPC rather than doing read-then-write
 * here, because two concurrent sends would otherwise both read the same
 * balance and both decide they could spend the last one. The decrement has to
 * happen inside a single statement under the row lock.
 */
export async function consumeEnvelope(tenantId: string): Promise<ConsumeResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("consume_envelope", {
    p_tenant_id: tenantId,
    p_allowance: MONTHLY_ALLOWANCE,
  });

  if (error) {
    return { ok: false, reason: "error", error: error.message, remaining: 0 };
  }

  const result = data as {
    ok: boolean;
    source?: "allowance" | "topup";
    reason?: string;
    remaining?: number;
  } | null;

  if (!result) {
    return {
      ok: false,
      reason: "error",
      error: "The envelope balance could not be read.",
      remaining: 0,
    };
  }

  if (!result.ok) {
    return { ok: false, reason: "out_of_envelopes", remaining: 0 };
  }

  return {
    ok: true,
    source: result.source ?? "allowance",
    remaining: result.remaining ?? 0,
  };
}

/**
 * Give an envelope back after a send that failed downstream.
 *
 * Never throws and never surfaces an error: it is only ever called from an
 * error path that is already returning a failure to the user, and replacing
 * "the signer's email address is invalid" with a refund error would hide the
 * thing they can actually fix. A refund that fails is logged and chased.
 */
export async function refundEnvelope(
  tenantId: string,
  source: "allowance" | "topup"
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("refund_envelope", {
      p_tenant_id: tenantId,
      p_source: source,
    });
    if (error) {
      console.error("[envelopes] refund failed — agency charged for a send that didn't go", {
        tenantId,
        source,
        error: error.message,
      });
    }
  } catch (err) {
    console.error("[envelopes] refund threw", { tenantId, source, err });
  }
}

/** Add purchased envelopes to the non-expiring pool. Returns the new total. */
export async function creditEnvelopes(
  tenantId: string,
  envelopes: number
): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("credit_envelopes", {
    p_tenant_id: tenantId,
    p_envelopes: envelopes,
    p_allowance: MONTHLY_ALLOWANCE,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, remaining: (data as number) ?? envelopes };
}

/**
 * The tenant's balance, for display.
 *
 * Read through the SSR client so RLS scopes it. Does NOT reset a stale
 * allowance — reading a page should not mutate anything, and `consume_envelope`
 * resets lazily at the moment it matters. The period is therefore applied here
 * in JS so a page loaded on the 1st shows the new allowance rather than last
 * month's exhausted one.
 */
export async function getEnvelopeBalance(tenantId: string): Promise<EnvelopeBalance> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_envelope_balances")
    .select("allowance_period, allowance_total, allowance_used, topup_balance, lifetime_sent")
    .eq("tenant_id", tenantId)
    .maybeSingle<{
      allowance_period: string;
      allowance_total: number;
      allowance_used: number;
      topup_balance: number;
      lifetime_sent: number;
    }>();

  // No row means nothing has been sent yet — the full allowance is available,
  // because the first send creates the row already stamped with this period.
  if (error || !data) {
    return { ...EMPTY_BALANCE, allowanceRemaining: MONTHLY_ALLOWANCE, remaining: MONTHLY_ALLOWANCE };
  }

  return projectBalance(data, currentPeriod(), MONTHLY_ALLOWANCE);
}
