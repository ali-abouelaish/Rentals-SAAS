"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { BillingPlan, BillingPaymentStatus } from "../domain/types";

const PLANS: BillingPlan[] = ["starter", "professional", "enterprise"];
const STATUSES: BillingPaymentStatus[] = ["active", "past_due", "canceled", "trialing", "unpaid"];

function parsePlan(v: unknown): BillingPlan {
  const s = String(v ?? "").toLowerCase();
  return PLANS.includes(s as BillingPlan) ? (s as BillingPlan) : "starter";
}

function parseStatus(v: unknown): BillingPaymentStatus {
  const s = String(v ?? "").toLowerCase();
  return STATUSES.includes(s as BillingPaymentStatus) ? (s as BillingPaymentStatus) : "active";
}

export async function upsertTenantBillingInfo(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);

  const plan = parsePlan(formData.get("plan"));
  const billing_email = String(formData.get("billing_email") ?? "").trim() || null;
  const billing_name = String(formData.get("billing_name") ?? "").trim() || null;
  const billing_address = String(formData.get("billing_address") ?? "").trim() || null;
  const payment_status = parseStatus(formData.get("payment_status"));
  const nextBillingRaw = String(formData.get("next_billing_date") ?? "").trim();
  const next_billing_date = nextBillingRaw || null;
  const stripe_customer_id = String(formData.get("stripe_customer_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const payload = {
    tenant_id: profile.tenant_id,
    plan,
    billing_email,
    billing_name,
    billing_address,
    payment_status,
    next_billing_date,
    stripe_customer_id,
    notes,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("tenant_billing_info").upsert(payload, {
    onConflict: "tenant_id",
    ignoreDuplicates: false,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings/billing-info");
}
