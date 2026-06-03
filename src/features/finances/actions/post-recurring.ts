"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { PropertyCost } from "@/features/profitability/domain/types";
import { COST_TYPE_LABELS } from "@/features/profitability/domain/types";
import { OVERHEAD_CATEGORY_LABELS, type BusinessOverhead } from "../domain/overheads";
import {
  TENANT_CHARGE_TYPE_LABELS,
  chargeActiveInMonth,
  type TenantRecurringCharge,
} from "../domain/tenant-charges";
import type { FinanceDirection, FinanceSourceKind, PostResult } from "../domain/entries";
import { assertMonthOpen } from "../lib/assertMonthOpen";

const SCHEDULE_DIVISOR: Record<"monthly" | "quarterly" | "biannual" | "annual", number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
};

type EntryDraft = {
  direction: FinanceDirection;
  amount: number; // pence, positive
  source_kind: FinanceSourceKind;
  source_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  contract_id: string | null;
  label: string;
  category: string | null;
};

function monthBounds(year: number, month: number): { msStr: string; meStr: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    msStr: start.toISOString().slice(0, 10),
    meStr: end.toISOString().slice(0, 10),
  };
}

type CostLike = {
  amount: number;
  cost_mode: PropertyCost["cost_mode"];
  amortise_months: number | null;
  amortise_start_date: string | null;
  date_incurred: string;
  is_active?: boolean;
};

function costAmountForMonth(cost: CostLike, msStr: string, meStr: string): number {
  if (cost.is_active === false) return 0;
  if (cost.cost_mode === "recurring") return cost.amount;
  if (cost.cost_mode === "amortised") {
    if (!cost.amortise_months || !cost.amortise_start_date) return 0;
    const aStart = new Date(cost.amortise_start_date);
    const aEnd = new Date(aStart);
    aEnd.setMonth(aEnd.getMonth() + cost.amortise_months);
    const monthStart = new Date(msStr);
    if (monthStart >= aStart && monthStart < aEnd) {
      return Math.round(cost.amount / cost.amortise_months);
    }
    return 0;
  }
  return cost.date_incurred >= msStr && cost.date_incurred <= meStr ? cost.amount : 0;
}

export async function postRecurringEntries(args: {
  year: number;
  month: number;
}): Promise<PostResult> {
  const { year, month } = args;
  const profile = await requireRole([...ADMIN_ROLES]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "Invalid month" };
  }

  const guard = await assertMonthOpen(year, month);
  if ("error" in guard) return { error: guard.error };

  const supabase = createSupabaseServerClient();
  const { msStr, meStr } = monthBounds(year, month);

  // ── Sources ──
  const [propsRes, unitsRes, costsRes, overheadsRes, tenantChargesRes, rentPaymentsRes] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, name, portfolio_id, monthly_rent_owed, payment_schedule, contract_start_date"),
      supabase.from("units").select("id, property_id"),
      supabase.from("property_costs").select("*"),
      supabase.from("business_overheads").select("*"),
      supabase
        .from("tenant_recurring_charges")
        .select(
          "id, contract_id, charge_type, label, amount, start_date, end_date, is_active"
        ),
      supabase
        .from("rent_payments")
        .select("id, contract_id, unit_id, amount, period_year, period_month, paid_at")
        .eq("period_year", year)
        .eq("period_month", month),
    ]);

  if (propsRes.error) return { error: propsRes.error.message };
  if (unitsRes.error) return { error: unitsRes.error.message };
  if (costsRes.error) return { error: costsRes.error.message };
  if (overheadsRes.error) return { error: overheadsRes.error.message };
  if (tenantChargesRes.error) return { error: tenantChargesRes.error.message };
  if (rentPaymentsRes.error) return { error: rentPaymentsRes.error.message };

  type PropertyRow = {
    id: string;
    name: string;
    portfolio_id: string | null;
    monthly_rent_owed: number | null;
    payment_schedule: keyof typeof SCHEDULE_DIVISOR | null;
    contract_start_date: string | null;
  };
  const properties = (propsRes.data ?? []) as PropertyRow[];
  const units = (unitsRes.data ?? []) as Array<{ id: string; property_id: string }>;
  const costs = (costsRes.data ?? []) as PropertyCost[];
  const overheads = (overheadsRes.data ?? []) as BusinessOverhead[];
  const tenantCharges = (tenantChargesRes.data ?? []) as Pick<
    TenantRecurringCharge,
    "id" | "contract_id" | "charge_type" | "label" | "amount" | "start_date" | "end_date" | "is_active"
  >[];
  const rentPayments = (rentPaymentsRes.data ?? []) as Array<{
    id: string;
    contract_id: string;
    unit_id: string;
    amount: number; // pounds
  }>;

  const unitToProperty = new Map<string, string>();
  for (const u of units) unitToProperty.set(u.id, u.property_id);

  const drafts: EntryDraft[] = [];

  // ── Property costs ──
  for (const c of costs) {
    const amt = costAmountForMonth(c, msStr, meStr);
    if (!amt) continue;
    drafts.push({
      direction: "expense",
      amount: amt,
      source_kind: "property_cost",
      source_id: c.id,
      property_id: c.property_id,
      unit_id: c.unit_id,
      contract_id: null,
      label: c.cost_label ?? COST_TYPE_LABELS[c.cost_type] ?? c.cost_type,
      category: c.cost_type,
    });
  }

  // ── Business overheads ──
  for (const o of overheads) {
    const amt = costAmountForMonth(o, msStr, meStr);
    if (!amt) continue;
    drafts.push({
      direction: "expense",
      amount: amt,
      source_kind: "business_overhead",
      source_id: o.id,
      property_id: null,
      unit_id: null,
      contract_id: null,
      label: o.label || OVERHEAD_CATEGORY_LABELS[o.category],
      category: o.category,
    });
  }

  // ── Tenant recurring charges ──
  for (const c of tenantCharges) {
    if (!chargeActiveInMonth(c, msStr, meStr)) continue;
    drafts.push({
      direction: "income",
      amount: c.amount,
      source_kind: "tenant_charge",
      source_id: c.id,
      property_id: null,
      unit_id: null,
      contract_id: c.contract_id,
      label: c.label || TENANT_CHARGE_TYPE_LABELS[c.charge_type],
      category: c.charge_type,
    });
  }

  // ── Rent payments (income, pounds → pence) ──
  for (const p of rentPayments) {
    const pence = Math.round(Number(p.amount) * 100);
    if (!pence) continue;
    drafts.push({
      direction: "income",
      amount: pence,
      source_kind: "rent_payment",
      source_id: p.id,
      property_id: unitToProperty.get(p.unit_id) ?? null,
      unit_id: p.unit_id,
      contract_id: p.contract_id,
      label: "Rent received",
      category: "rent",
    });
  }

  // ── Owner rent (synthetic, deduped by property_id) ──
  for (const prop of properties) {
    const ownerRentPence = Math.round(
      (Number(prop.monthly_rent_owed ?? 0) * 100) /
        (prop.payment_schedule ? SCHEDULE_DIVISOR[prop.payment_schedule] ?? 1 : 1)
    );
    if (!ownerRentPence) continue;
    // Only post owner rent for months that fall on/after the property's
    // contract_start_date (when known), to avoid back-dating costs into
    // months when the agency wasn't operating the property yet.
    if (prop.contract_start_date && prop.contract_start_date > meStr) continue;
    drafts.push({
      direction: "expense",
      amount: ownerRentPence,
      source_kind: "owner_rent",
      source_id: prop.id, // dedup key
      property_id: prop.id,
      unit_id: null,
      contract_id: null,
      label: `Owner rent · ${prop.name}`,
      category: "owner_rent",
    });
  }

  if (drafts.length === 0) {
    return { success: true, inserted: 0, skipped: 0 };
  }

  // ── Pre-fetch existing (source_kind, source_id) pairs for this month ──
  // The unique index on finance_entries is partial (WHERE source_id IS NOT NULL),
  // which PostgREST's onConflict can't target. We dedupe in app code instead,
  // and rely on the partial index as a backstop against races.
  const { data: existingRows, error: fetchErr } = await supabase
    .from("finance_entries")
    .select("source_kind, source_id")
    .eq("year", year)
    .eq("month", month)
    .not("source_id", "is", null);

  if (fetchErr) {
    const msg = fetchErr.message.toLowerCase();
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      return {
        error: "finance_entries table is missing. Apply the latest Supabase migrations first.",
      };
    }
    return { error: fetchErr.message };
  }

  const existingKey = new Set(
    (existingRows ?? []).map((r) => `${r.source_kind}:${r.source_id}`)
  );

  const newDrafts = drafts.filter((d) => {
    if (d.source_id === null) return true; // manual adjustments aren't deduped
    return !existingKey.has(`${d.source_kind}:${d.source_id}`);
  });

  const skipped = drafts.length - newDrafts.length;
  if (newDrafts.length === 0) {
    return { success: true, inserted: 0, skipped };
  }

  const rows = newDrafts.map((d) => ({
    tenant_id: profile.tenant_id,
    year,
    month,
    direction: d.direction,
    amount: d.amount,
    source_kind: d.source_kind,
    source_id: d.source_id,
    property_id: d.property_id,
    unit_id: d.unit_id,
    contract_id: d.contract_id,
    label: d.label,
    category: d.category,
    posted_by: profile.id,
  }));

  const { data: inserted, error } = await supabase
    .from("finance_entries")
    .insert(rows)
    .select("id");

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      return {
        error: "finance_entries table is missing. Apply the latest Supabase migrations first.",
      };
    }
    // If a race condition tripped the partial unique index, surface a friendly message.
    if (error.code === "23505") {
      return {
        error: "Another post is already in progress. Refresh and try again.",
      };
    }
    return { error: error.message };
  }

  const insertedCount = (inserted ?? []).length;

  revalidatePath("/finances");
  revalidatePath("/finances/close");
  return { success: true, inserted: insertedCount, skipped };
}
