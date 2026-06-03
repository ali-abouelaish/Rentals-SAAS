"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES, SUPER_ADMIN_ROLES } from "@/lib/auth/roles";
import { getFinanceRollup } from "../data/queries";
import type { MonthlyCloseChecklist, MonthlyCloseSnapshot } from "../domain/closes";

function isFutureOrCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  const currentY = now.getUTCFullYear();
  const currentM = now.getUTCMonth() + 1;
  if (year > currentY) return true;
  if (year < currentY) return false;
  return month >= currentM;
}

type ChecklistComputed = {
  checklist: MonthlyCloseChecklist;
  blockers: string[];
};

async function computeChecklist(year: number, month: number): Promise<ChecklistComputed> {
  const supabase = createSupabaseServerClient();
  const blockers: string[] = [];

  // 1) Rent recorded — every active rent_payments expected for the month has been logged?
  //    Pragmatic heuristic: at least one rent_payments row exists for any contract that
  //    was active in this month. Stricter than nothing, looser than every-contract-must-pay.
  const { count: rentCount } = await supabase
    .from("rent_payments")
    .select("id", { count: "exact", head: true })
    .eq("period_year", year)
    .eq("period_month", month);
  const rentRecorded = (rentCount ?? 0) > 0;
  if (!rentRecorded) blockers.push("No rent payments recorded for this month");

  // 2) Recurring posted — at least one finance_entries row for the month?
  const { count: entriesCount, error: entriesErr } = await supabase
    .from("finance_entries")
    .select("id", { count: "exact", head: true })
    .eq("year", year)
    .eq("month", month);
  const recurringPosted =
    !entriesErr && (entriesCount ?? 0) > 0;
  if (!recurringPosted) blockers.push("Recurring entries have not been posted yet");

  // 3) Bank reconciled — no unmatched flagged rent and we have a credit feed.
  const { count: flagsCount } = await supabase
    .from("rent_payment_flags")
    .select("id", { count: "exact", head: true })
    .eq("resolved", false);
  const startStr = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const endStr = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const { count: creditsCount } = await supabase
    .from("bank_transactions")
    .select("id", { count: "exact", head: true })
    .eq("transaction_type", "credit")
    .gte("transaction_date", startStr)
    .lte("transaction_date", endStr);
  const bankReconciled = (flagsCount ?? 0) === 0 && (creditsCount ?? 0) > 0;
  if (!bankReconciled) {
    if ((creditsCount ?? 0) === 0)
      blockers.push("No bank statement uploaded for this month");
    if ((flagsCount ?? 0) > 0)
      blockers.push(`${flagsCount} unresolved rent reconciliation flags`);
  }

  return {
    checklist: {
      rent_recorded: rentRecorded,
      recurring_posted: recurringPosted,
      bank_reconciled: bankReconciled,
      // The reviewed flags are admin attestations; we keep them sticky by reading
      // any existing row in beginReview/closeMonth.
      costs_reviewed: false,
      overheads_reviewed: false,
    },
    blockers,
  };
}

async function snapshotForMonth(year: number, month: number): Promise<MonthlyCloseSnapshot> {
  const rollup = await getFinanceRollup(year, month);
  return {
    rent_expected: rollup.rent_expected,
    rent_received: rollup.rent_received,
    rent_outstanding: rollup.rent_outstanding,
    tenant_charges_expected: rollup.tenant_charges_expected,
    property_costs: rollup.property_costs,
    owner_rent: rollup.owner_rent,
    admin_overheads: rollup.admin_overheads,
    total_costs: rollup.total_costs,
    vacancy_loss: rollup.vacancy_loss,
    net_profit: rollup.net_profit,
    bank_credits_total: rollup.bank_credits_total,
    bank_credits_matched: rollup.bank_credits_matched,
    bank_credits_unmatched: rollup.bank_credits_unmatched,
    by_portfolio: rollup.by_portfolio.map((p) => ({
      portfolio_id: p.portfolio_id,
      portfolio_name: p.portfolio_name,
      rent_received: p.rent_received,
      property_costs: p.property_costs,
      owner_rent: p.owner_rent,
      net_profit: p.net_profit,
    })),
    by_property: rollup.by_property.map((p) => ({
      property_id: p.property_id,
      property_name: p.property_name,
      portfolio_name: p.portfolio_name,
      rent_received: p.rent_received,
      property_costs: p.property_costs,
      owner_rent: p.owner_rent,
      net_profit: p.net_profit,
    })),
    costs_by_category: rollup.costs_by_category,
  };
}

export async function refreshChecklist(args: { year: number; month: number }) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const { year, month } = args;
  const { checklist } = await computeChecklist(year, month);
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("monthly_closes")
    .select("id, status, checklist")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  type Existing = {
    id: string;
    status: "open" | "in_review" | "closed";
    checklist: Partial<MonthlyCloseChecklist> | null;
  };
  const ex = existing as Existing | null;

  // Preserve sticky admin-attested flags (costs_reviewed, overheads_reviewed).
  const merged: MonthlyCloseChecklist = {
    ...checklist,
    costs_reviewed: ex?.checklist?.costs_reviewed ?? false,
    overheads_reviewed: ex?.checklist?.overheads_reviewed ?? false,
  };

  if (ex) {
    const { error } = await supabase
      .from("monthly_closes")
      .update({ checklist: merged, updated_at: new Date().toISOString() })
      .eq("id", ex.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("monthly_closes").insert({
      tenant_id: profile.tenant_id,
      year,
      month,
      status: "open",
      checklist: merged,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/finances/close");
  return { success: true, checklist: merged };
}

export async function toggleAttestation(args: {
  year: number;
  month: number;
  key: "costs_reviewed" | "overheads_reviewed";
  value: boolean;
}) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const { year, month, key, value } = args;
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("monthly_closes")
    .select("id, status, checklist")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  type Existing = {
    id: string;
    status: "open" | "in_review" | "closed";
    checklist: Partial<MonthlyCloseChecklist> | null;
  };
  const ex = existing as Existing | null;

  if (ex?.status === "closed") {
    return { error: "Cannot edit a closed month. Reopen it first." };
  }

  const checklist: Partial<MonthlyCloseChecklist> = { ...(ex?.checklist ?? {}), [key]: value };

  if (ex) {
    const { error } = await supabase
      .from("monthly_closes")
      .update({ checklist, updated_at: new Date().toISOString() })
      .eq("id", ex.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("monthly_closes").insert({
      tenant_id: profile.tenant_id,
      year,
      month,
      status: "open",
      checklist,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/finances/close");
  return { success: true };
}

export async function beginReview(args: { year: number; month: number }) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const { year, month } = args;
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("monthly_closes")
    .select("id, status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  type Existing = { id: string; status: "open" | "in_review" | "closed" };
  const ex = existing as Existing | null;

  if (ex?.status === "closed") {
    return { error: "Month is already closed." };
  }

  if (ex) {
    const { error } = await supabase
      .from("monthly_closes")
      .update({ status: "in_review", updated_at: new Date().toISOString() })
      .eq("id", ex.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("monthly_closes").insert({
      tenant_id: profile.tenant_id,
      year,
      month,
      status: "in_review",
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/finances/close");
  revalidatePath("/finances");
  return { success: true };
}

export async function closeMonth(args: { year: number; month: number }) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const { year, month } = args;

  if (isFutureOrCurrentMonth(year, month)) {
    return { error: "Cannot close the current or a future month." };
  }

  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("monthly_closes")
    .select("id, status, checklist")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  type Existing = {
    id: string;
    status: "open" | "in_review" | "closed";
    checklist: Partial<MonthlyCloseChecklist> | null;
  };
  const ex = existing as Existing | null;
  if (ex?.status === "closed") {
    return { error: "Month is already closed." };
  }

  // Recompute the checklist fresh so we can't close on stale state.
  const { checklist: computed, blockers } = await computeChecklist(year, month);
  const merged: MonthlyCloseChecklist = {
    ...computed,
    costs_reviewed: ex?.checklist?.costs_reviewed ?? false,
    overheads_reviewed: ex?.checklist?.overheads_reviewed ?? false,
  };

  const unchecked: string[] = [...blockers];
  if (!merged.costs_reviewed) unchecked.push("Property costs not marked reviewed");
  if (!merged.overheads_reviewed) unchecked.push("Admin overheads not marked reviewed");

  if (unchecked.length > 0) {
    return { error: `Cannot close month: ${unchecked.join("; ")}` };
  }

  const snapshot = await snapshotForMonth(year, month);
  const closedAt = new Date().toISOString();

  const baseRow = {
    tenant_id: profile.tenant_id,
    year,
    month,
    status: "closed" as const,
    checklist: merged,
    snapshot,
    closed_at: closedAt,
    closed_by: profile.id,
    reopened_at: null,
    reopened_by: null,
    updated_at: closedAt,
  };

  let closeId: string;
  if (ex) {
    const { data, error } = await supabase
      .from("monthly_closes")
      .update(baseRow)
      .eq("id", ex.id)
      .select("id")
      .single();
    if (error) return { error: error.message };
    closeId = (data as { id: string }).id;
  } else {
    const { data, error } = await supabase
      .from("monthly_closes")
      .insert(baseRow)
      .select("id")
      .single();
    if (error) return { error: error.message };
    closeId = (data as { id: string }).id;
  }

  // Stamp existing finance_entries for the period with the close_id so they
  // can be filtered as "frozen" lines in reporting.
  await supabase
    .from("finance_entries")
    .update({ close_id: closeId })
    .eq("year", year)
    .eq("month", month);

  revalidatePath("/finances");
  revalidatePath("/finances/close");
  revalidatePath(`/finances/close/${year}/${String(month).padStart(2, "0")}`);
  return { success: true };
}

export async function reopenMonth(args: { year: number; month: number; note?: string }) {
  // Reopen is a heavier action — restrict to super admin tier.
  const profile = await requireRole([...SUPER_ADMIN_ROLES]);
  const { year, month, note } = args;
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("monthly_closes")
    .select("id, status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  type Existing = { id: string; status: "open" | "in_review" | "closed" };
  const ex = existing as Existing | null;
  if (!ex) return { error: "Month is not closed." };
  if (ex.status !== "closed") return { error: "Month is not closed." };

  const { error } = await supabase
    .from("monthly_closes")
    .update({
      status: "in_review",
      reopened_at: new Date().toISOString(),
      reopened_by: profile.id,
      notes: note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ex.id);
  if (error) return { error: error.message };

  // Clear the close_id stamp on finance_entries for the month.
  await supabase
    .from("finance_entries")
    .update({ close_id: null })
    .eq("year", year)
    .eq("month", month);

  revalidatePath("/finances");
  revalidatePath("/finances/close");
  revalidatePath(`/finances/close/${year}/${String(month).padStart(2, "0")}`);
  return { success: true };
}
