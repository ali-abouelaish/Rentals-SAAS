"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { bankDetailsSchema, type BankDetailsValues } from "../domain/schemas";

async function ensurePortfolioInTenant(portfolioId: string, tenantId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Portfolio not found");
}

export async function createPortfolioBankDetails(
  portfolioId: string,
  values: BankDetailsValues
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = bankDetailsSchema.parse(values);

  await ensurePortfolioInTenant(portfolioId, profile.tenant_id);

  // Auto-default if this is the portfolio's first account.
  const { count } = await supabase
    .from("portfolio_bank_details")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_id", portfolioId)
    .eq("tenant_id", profile.tenant_id);

  const isFirst = (count ?? 0) === 0;

  const { data, error } = await supabase
    .from("portfolio_bank_details")
    .insert({
      tenant_id: profile.tenant_id,
      portfolio_id: portfolioId,
      label: payload.label,
      account_holder_name: payload.account_holder_name ?? null,
      account_number: payload.account_number ?? null,
      sort_code: payload.sort_code ?? null,
      bank_name: payload.bank_name ?? null,
      payment_reference_hint: payload.payment_reference_hint ?? null,
      is_default: isFirst,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/settings/bank-details");
  return data;
}

export async function updatePortfolioBankDetails(id: string, values: BankDetailsValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = bankDetailsSchema.parse(values);

  const { error } = await supabase
    .from("portfolio_bank_details")
    .update({
      label: payload.label,
      account_holder_name: payload.account_holder_name ?? null,
      account_number: payload.account_number ?? null,
      sort_code: payload.sort_code ?? null,
      bank_name: payload.bank_name ?? null,
      payment_reference_hint: payload.payment_reference_hint ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/bank-details");
}

export async function setDefaultPortfolioBankDetails(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: target, error: lookupError } = await supabase
    .from("portfolio_bank_details")
    .select("id, portfolio_id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!target) throw new Error("Bank details not found");

  // Clear previous default in the same portfolio first to satisfy the
  // unique-default partial index, then set the new one.
  const { error: clearError } = await supabase
    .from("portfolio_bank_details")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("portfolio_id", target.portfolio_id)
    .eq("tenant_id", profile.tenant_id)
    .eq("is_default", true);

  if (clearError) throw new Error(clearError.message);

  const { error: setError } = await supabase
    .from("portfolio_bank_details")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (setError) throw new Error(setError.message);
  revalidatePath("/settings/bank-details");
}

export async function deletePortfolioBankDetails(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: target, error: lookupError } = await supabase
    .from("portfolio_bank_details")
    .select("id, portfolio_id, is_default")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!target) throw new Error("Bank details not found");

  const { error } = await supabase
    .from("portfolio_bank_details")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);

  // If we just removed the default, promote the oldest remaining account so the
  // portfolio still has a default for forms to inherit.
  if (target.is_default) {
    const { data: next } = await supabase
      .from("portfolio_bank_details")
      .select("id")
      .eq("portfolio_id", target.portfolio_id)
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("portfolio_bank_details")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", next.id)
        .eq("tenant_id", profile.tenant_id);
    }
  }

  revalidatePath("/settings/bank-details");
}
