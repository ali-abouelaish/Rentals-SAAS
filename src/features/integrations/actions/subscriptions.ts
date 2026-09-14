"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getIntegration } from "@/lib/integrations/catalog";
import {
  endOfCurrentMonth,
  firstOfNextMonth,
  subscriptionGrantsAccess,
} from "@/lib/integrations/subscriptions";
import {
  activateIntegrationSchema,
  cancelIntegrationSchema,
} from "../domain/schemas";

type Result = { error: string } | { success: true; message: string };

/**
 * Turn an integration on.
 *
 * No payment is taken. The row records the price agreed and the first invoice
 * it lands on; the super-admin billing view raises the charge from there. That
 * is the whole reason activation can be instant.
 *
 * The price is read from the catalogue HERE and frozen onto the row, so a later
 * catalogue change re-prices only new subscribers.
 */
export async function activateIntegrationAction(input: {
  integrationKey: string;
  acceptCharge: boolean;
}): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const parsed = activateIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const integration = getIntegration(parsed.data.integrationKey);
  if (!integration) {
    return { error: "That integration does not exist." };
  }

  if (integration.availability !== "available") {
    return {
      error: `${integration.name} isn't available yet. We'll let you know when it is.`,
    };
  }

  const admin = createSupabaseAdminClient();

  // Re-activating a cancelled subscription is an update, not a second row —
  // the unique index on (tenant_id, integration_key) makes that the only
  // option, and it keeps the history of when the agency first took it.
  const { data: existing, error: readError } = await admin
    .from("tenant_integration_subscriptions")
    .select("id, status, ends_on, is_grandfathered, activated_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("integration_key", integration.key)
    .maybeSingle<{
      id: string;
      status: "active" | "pending_setup" | "cancelled";
      ends_on: string | null;
      is_grandfathered: boolean;
      activated_at: string | null;
    }>();

  if (readError) return { error: readError.message };

  if (existing && subscriptionGrantsAccess(existing) && existing.status !== "cancelled") {
    return { error: `${integration.name} is already active.` };
  }

  // An integration that needs credentials or a mailbox verified is subscribed
  // but not yet usable. It still grants the feature — the agency has to reach
  // the setup screen, which the feature owns.
  const status = integration.requiresSetup ? "pending_setup" : "active";

  const values = {
    tenant_id: profile.tenant_id,
    integration_key: integration.key,
    status,
    // A grandfathered agency that cancels and comes back loses the free ride;
    // one that never cancelled keeps it, because the row is never rewritten.
    monthly_price_pence: integration.monthlyPricePence,
    is_grandfathered: false,
    activated_at: existing?.activated_at ?? new Date().toISOString(),
    activated_by: profile.id,
    // Cleared so a re-activation doesn't carry the old cancellation forward and
    // expire itself at the end of the month.
    cancelled_at: null,
    cancelled_by: null,
    ends_on: null,
    billing_starts_on: integration.monthlyPricePence > 0 ? firstOfNextMonth() : null,
  };

  const { error: writeError } = existing
    ? await admin
        .from("tenant_integration_subscriptions")
        .update(values)
        .eq("id", existing.id)
    : await admin.from("tenant_integration_subscriptions").insert(values);

  if (writeError) return { error: writeError.message };

  // The sidebar and every gated page read entitlements server-side, so the
  // whole app layout is stale until it is revalidated.
  revalidatePath("/", "layout");

  const priceNote =
    integration.monthlyPricePence > 0
      ? ` It will appear on your invoice from ${formatDate(values.billing_starts_on!)}.`
      : "";

  return {
    success: true,
    message: `${integration.name} activated.${priceNote}`,
  };
}

/**
 * Turn an integration off at the end of the paid period.
 *
 * Not immediately: the agency has paid for the month, and pulling deposit
 * protection out from under a tenancy that has to be registered within 30 days
 * would be an own goal. The row stays so the billing view can still see what
 * ran during the period.
 */
export async function cancelIntegrationAction(input: {
  integrationKey: string;
  reason?: string;
}): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const parsed = cancelIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const integration = getIntegration(parsed.data.integrationKey);
  if (!integration) {
    return { error: "That integration does not exist." };
  }

  const admin = createSupabaseAdminClient();

  const { data: existing, error: readError } = await admin
    .from("tenant_integration_subscriptions")
    .select("id, status, notes")
    .eq("tenant_id", profile.tenant_id)
    .eq("integration_key", integration.key)
    .maybeSingle<{ id: string; status: string; notes: string | null }>();

  if (readError) return { error: readError.message };
  if (!existing) return { error: `${integration.name} isn't active.` };
  if (existing.status === "cancelled") {
    return { error: `${integration.name} is already cancelled.` };
  }

  const endsOn = endOfCurrentMonth();
  const reason = parsed.data.reason?.trim();

  const { error: writeError } = await admin
    .from("tenant_integration_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
      ends_on: endsOn,
      notes: reason ? `Cancellation reason: ${reason}` : existing.notes,
    })
    .eq("id", existing.id);

  if (writeError) return { error: writeError.message };

  revalidatePath("/", "layout");

  return {
    success: true,
    message: `${integration.name} will stay available until ${formatDate(endsOn)}.`,
  };
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
