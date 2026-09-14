"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { creditEnvelopes, getEnvelopeBalance } from "@/lib/envelopes/balance";
import { formatPence, getEnvelopePack, type EnvelopeBalance } from "@/lib/envelopes/packs";
import { firstOfNextMonth } from "@/lib/integrations/access";
import { purchaseEnvelopesSchema } from "../domain/envelopeSchemas";

type PurchaseResult =
  | { error: string }
  | { success: true; message: string; remaining: number };

/**
 * Buy a top-up pack.
 *
 * No payment is taken, matching integration activation: the purchase is
 * recorded with the price agreed and the invoice it lands on, and the super
 * admin bills it. That is what lets the buy dialog resolve a blocked send in
 * one click — the whole point of having it.
 *
 * Credit is applied BEFORE the purchase row is written. If the order were
 * reversed and the credit failed, the agency would have a bill and no
 * envelopes; this way the worst case is envelopes nobody was charged for,
 * which is the right direction to fail and is visible in the balance.
 */
export async function purchaseEnvelopesAction(input: {
  packKey: string;
  acceptCharge: boolean;
}): Promise<PurchaseResult> {
  const profile = await requireRole([...ADMIN_ROLES]);

  if (!(await hasFeature("e_signing"))) {
    return {
      error: "E-signing isn't active on your account. Activate it under Settings → Integrations.",
    };
  }

  const parsed = purchaseEnvelopesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const pack = getEnvelopePack(parsed.data.packKey);
  if (!pack) return { error: "That pack doesn't exist." };

  const credited = await creditEnvelopes(profile.tenant_id, pack.envelopes);
  if (!credited.ok) return { error: credited.error };

  const billingPeriod = firstOfNextMonth();

  const { error: recordError } = await createSupabaseAdminClient()
    .from("tenant_envelope_purchases")
    .insert({
      tenant_id: profile.tenant_id,
      pack_key: pack.key,
      envelopes: pack.envelopes,
      // Frozen at the point of sale — a later price change must not rewrite
      // what somebody already bought.
      price_pence: pack.pricePence,
      billing_period: billingPeriod,
      purchased_by: profile.id,
    });

  if (recordError) {
    // The envelopes are already usable. Failing the whole action now would
    // tell the agency the purchase didn't work while they can plainly see the
    // balance went up, so this reports success and flags the billing gap.
    console.error("[envelopes] credited but purchase not recorded — will not be invoiced", {
      tenantId: profile.tenant_id,
      packKey: pack.key,
      pricePence: pack.pricePence,
      error: recordError.message,
    });
  }

  revalidatePath("/settings/e-signing");
  revalidatePath("/contracts");
  revalidatePath("/maintenance");

  return {
    success: true,
    message: `${pack.envelopes} envelopes added. ${formatPence(pack.pricePence)} goes on your next invoice.`,
    remaining: credited.remaining,
  };
}

/**
 * The current balance, for the signing panel.
 *
 * A server action rather than a prop because the panels live in client drawers
 * that have no access to the tenant, and because the number changes on every
 * send — including sends made in another tab.
 */
export async function getEnvelopeBalanceAction(): Promise<EnvelopeBalance | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("e_signing"))) return null;
  return getEnvelopeBalance(profile.tenant_id);
}
