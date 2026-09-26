"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditDiff, logPlatformAudit } from "@/lib/audit/platformAudit";
import { formatPence } from "@/lib/envelopes/packs";
import { getIntegration } from "@/lib/integrations/catalog";

/**
 * Setting what an agency pays.
 *
 * Two halves, because an agency bill has two halves:
 *
 *   CHARGES       — what we agreed with them. The base monthly fee, any custom
 *                   line, any ongoing discount. Free-form, set here.
 *   SUBSCRIPTIONS — catalogue add-ons they switched on themselves, priced from
 *                   src/lib/integrations/catalog.ts and frozen at activation.
 *                   A super admin can override that frozen price, which is what
 *                   a negotiated rate is.
 *
 * Everything here writes through the service role behind requireSuperAdmin() and
 * is audited: these are the numbers the business runs on, and a price that
 * changed with no record of who changed it is not a price anyone can defend.
 */

type Result = { error: string } | { success: true; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Every surface that shows a price, so none of them goes stale after a write. */
function revalidateAll(tenantId: string) {
  for (const path of [
    `/admin/tenants/${tenantId}/billing`,
    `/admin/tenants/${tenantId}/features`,
    "/admin/billing",
    "/admin/finance",
    "/admin"
  ]) {
    revalidatePath(path);
  }
}

// ============================================================
// Agreed charges
// ============================================================

const chargeSchema = z
  .object({
    tenantId: z.string().uuid("Invalid agency"),
    label: z
      .string()
      .trim()
      .min(2, "Give the charge a name of at least 2 characters")
      .max(120, "Keep the name under 120 characters"),
    // Negative is allowed and meaningful: a recurring discount. Zero is not —
    // it raises no line, so it would be a row that does nothing.
    amountPence: z
      .number({ invalid_type_error: "Enter an amount" })
      .int("Amount must be a whole number of pence")
      .refine((v) => v !== 0, "An amount of zero would never appear on an invoice")
      .refine(
        (v) => Math.abs(v) <= 10_000_000,
        "That is over £100,000 a month — check the amount"
      ),
    billingStartsOn: z.string().regex(ISO_DATE, "Pick a start date"),
    endsOn: z.string().regex(ISO_DATE, "Use a valid date").nullable().optional(),
    notes: z.string().trim().max(1000, "Keep notes under 1000 characters").optional()
  })
  .refine((v) => !v.endsOn || v.endsOn >= v.billingStartsOn, {
    message: "The end date cannot be before the start date",
    path: ["endsOn"]
  });

export type ChargeInput = z.input<typeof chargeSchema>;

function describeCharge(label: string, amountPence: number): string {
  const direction = amountPence < 0 ? "discount" : "charge";
  return `${label} — ${formatPence(Math.abs(amountPence))}/month ${direction}`;
}

export async function createPlatformChargeAction(input: ChargeInput): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = chargeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const v = parsed.data;
  const admin = createSupabaseAdminClient();

  const values = {
    tenant_id: v.tenantId,
    label: v.label,
    amount_pence: v.amountPence,
    billing_starts_on: v.billingStartsOn,
    ends_on: v.endsOn ?? null,
    notes: v.notes?.trim() || null
  };

  const { data, error } = await admin
    .from("tenant_platform_charges")
    .insert({ ...values, created_by: actor.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not save the charge." };
  }

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "platform_charge_created",
    summary: `Pricing set — ${describeCharge(v.label, v.amountPence)}`,
    tenantId: v.tenantId,
    entityType: "platform_charge",
    entityId: data.id as string,
    after: values,
    // Setting what a customer pays is the most consequential number here.
    severity: "warning"
  });

  revalidateAll(v.tenantId);
  return {
    success: true,
    message: "Charge added. It appears on the next invoice generated for its start month."
  };
}

export async function updatePlatformChargeAction(
  input: ChargeInput & { id: string }
): Promise<Result> {
  const actor = await requireSuperAdmin();

  if (!z.string().uuid().safeParse(input.id).success) {
    return { error: "Invalid charge." };
  }

  const parsed = chargeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const v = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: prior } = await admin
    .from("tenant_platform_charges")
    .select("label, amount_pence, billing_starts_on, ends_on, notes")
    .eq("id", input.id)
    .maybeSingle();

  const values = {
    label: v.label,
    amount_pence: v.amountPence,
    billing_starts_on: v.billingStartsOn,
    ends_on: v.endsOn ?? null,
    notes: v.notes?.trim() || null
  };

  const { error } = await admin
    .from("tenant_platform_charges")
    .update(values)
    .eq("id", input.id);

  if (error) return { error: error.message };

  const diff = auditDiff(prior ?? null, values);

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "platform_charge_updated",
    summary: `Pricing changed — ${describeCharge(v.label, v.amountPence)}`,
    tenantId: v.tenantId,
    entityType: "platform_charge",
    entityId: input.id,
    before: diff.before,
    after: diff.after,
    severity: "warning"
  });

  revalidateAll(v.tenantId);
  return {
    success: true,
    message:
      "Charge updated. A draft invoice picks this up next time you generate; an issued one is unchanged."
  };
}

export async function deletePlatformChargeAction(input: {
  id: string;
  tenantId: string;
}): Promise<Result> {
  const actor = await requireSuperAdmin();

  if (!z.string().uuid().safeParse(input.id).success) {
    return { error: "Invalid charge." };
  }

  const admin = createSupabaseAdminClient();

  const { data: prior } = await admin
    .from("tenant_platform_charges")
    .select("label, amount_pence, billing_starts_on, ends_on, notes")
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await admin
    .from("tenant_platform_charges")
    .delete()
    .eq("id", input.id);

  if (error) return { error: error.message };

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "platform_charge_deleted",
    summary: `Pricing removed — ${prior?.label ?? "charge"}${
      prior ? ` (${formatPence(Math.abs(prior.amount_pence as number))}/month)` : ""
    }`,
    tenantId: input.tenantId,
    entityType: "platform_charge",
    entityId: input.id,
    // The whole row, so a deletion made in error can be put back.
    before: (prior as Record<string, unknown>) ?? null,
    severity: "warning"
  });

  revalidateAll(input.tenantId);
  return {
    success: true,
    message:
      "Charge removed. To stop billing from a date instead, set an end date rather than deleting."
  };
}

// ============================================================
// Subscription price override
// ============================================================

const subscriptionPricingSchema = z
  .object({
    tenantId: z.string().uuid("Invalid agency"),
    integrationKey: z.string().min(1, "Invalid integration"),
    monthlyPricePence: z
      .number({ invalid_type_error: "Enter a price" })
      .int("Price must be a whole number of pence")
      .min(0, "Price cannot be negative")
      .max(10_000_000, "That is over £100,000 a month — check the price"),
    isGrandfathered: z.boolean(),
    billingStartsOn: z.string().regex(ISO_DATE, "Use a valid date").nullable().optional(),
    endsOn: z.string().regex(ISO_DATE, "Use a valid date").nullable().optional()
  })
  .refine((v) => !v.endsOn || !v.billingStartsOn || v.endsOn >= v.billingStartsOn, {
    message: "The end date cannot be before billing starts",
    path: ["endsOn"]
  });

export type SubscriptionPricingInput = z.input<typeof subscriptionPricingSchema>;

/**
 * Override the frozen price on an add-on subscription.
 *
 * The catalogue price is copied onto the subscription row at activation so a
 * later catalogue change never re-prices anyone already subscribed. That is the
 * right default and stays — but it left no way to agree a different rate with
 * one agency, which is the ordinary case for a customer who negotiated.
 *
 * Changes one agency row only; the catalogue is untouched.
 */
export async function updateSubscriptionPricingAction(
  input: SubscriptionPricingInput
): Promise<Result> {
  const actor = await requireSuperAdmin();

  const parsed = subscriptionPricingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const v = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: prior } = await admin
    .from("tenant_integration_subscriptions")
    .select("monthly_price_pence, is_grandfathered, billing_starts_on, ends_on")
    .eq("tenant_id", v.tenantId)
    .eq("integration_key", v.integrationKey)
    .maybeSingle();

  if (!prior) {
    return { error: "That agency is not subscribed to this integration." };
  }

  const values = {
    monthly_price_pence: v.monthlyPricePence,
    is_grandfathered: v.isGrandfathered,
    billing_starts_on: v.billingStartsOn ?? null,
    ends_on: v.endsOn ?? null
  };

  const { error } = await admin
    .from("tenant_integration_subscriptions")
    .update(values)
    .eq("tenant_id", v.tenantId)
    .eq("integration_key", v.integrationKey);

  if (error) return { error: error.message };

  const diff = auditDiff(prior as Record<string, unknown>, values);
  const name = getIntegration(v.integrationKey)?.name ?? v.integrationKey;

  await logPlatformAudit({
    actor: { id: actor.id },
    category: "billing",
    action: "subscription_price_overridden",
    summary: `${name} re-priced — ${formatPence(
      prior.monthly_price_pence as number
    )} → ${formatPence(v.monthlyPricePence)}/month`,
    tenantId: v.tenantId,
    entityType: "integration_subscription",
    entityId: v.integrationKey,
    before: diff.before,
    after: diff.after,
    severity: "warning"
  });

  revalidateAll(v.tenantId);
  return { success: true, message: `${name} re-priced.` };
}
