"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { COST_TYPE_LABELS } from "@/features/profitability/domain/types";
import type { PropertyCost } from "@/features/profitability/domain/types";
import {
  OVERHEAD_CATEGORY_LABELS,
  type BusinessOverhead,
} from "../domain/overheads";
import { chargeActiveInMonth } from "../domain/tenant-charges";
import type {
  FinanceMonthRollup,
  FinancePortfolioBreakdown,
  FinancePropertyBreakdown,
  FinanceCostCategoryBreakdown,
  MonthKey,
} from "../domain/types";

const SCHEDULE_DIVISOR: Record<"monthly" | "quarterly" | "biannual" | "annual", number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
};

const VACANT_STATUSES = new Set(["available", "on_hold"]);

function monthBounds(year: number, month: number): { start: Date; end: Date; startStr: string; endStr: string; daysInMonth: number } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    start,
    end,
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10),
    daysInMonth: end.getUTCDate(),
  };
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type CostLike = {
  amount: number;
  cost_mode: PropertyCost["cost_mode"];
  amortise_months: number | null;
  amortise_start_date: string | null;
  date_incurred: string;
  is_active?: boolean;
};

/** Pence cost of a cost-like line for the given month (start..end inclusive). */
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
  // one_off
  return cost.date_incurred >= msStr && cost.date_incurred <= meStr ? cost.amount : 0;
}

export async function getFinanceRollup(year: number, month: number): Promise<FinanceMonthRollup> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { startStr: msStr, endStr: meStr, daysInMonth } = monthBounds(year, month);
  const now = new Date();
  const isCurrentMonth = now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;
  const isFutureMonth = year > now.getUTCFullYear() || (year === now.getUTCFullYear() && month > now.getUTCMonth() + 1);

  // ── Properties (for owner rent + portfolio mapping) ──
  const { data: properties, error: propErr } = await supabase
    .from("properties")
    .select("id, name, portfolio_id, monthly_rent_owed, payment_schedule, portfolios(id, name, color)");
  if (propErr) throw new Error(propErr.message);

  type PortfolioRef = { id?: string; name?: string; color?: string } | null;
  type PropertyRow = {
    id: string;
    name: string;
    portfolio_id: string | null;
    monthly_rent_owed: number | null;
    payment_schedule: keyof typeof SCHEDULE_DIVISOR | null;
    portfolios: PortfolioRef | PortfolioRef[];
  };
  const props = (properties ?? []) as unknown as PropertyRow[];

  // ── Units (only used for current-month vacancy loss) ──
  const { data: units, error: unitErr } = await supabase
    .from("units")
    .select("id, property_id, status, available_date, max_price_pcm");
  if (unitErr) throw new Error(unitErr.message);

  // ── Active-ish contracts in the month (for expected rent) ──
  // We pull all contracts whose date range can overlap the month. Mirrors
  // src/features/profitability/data/queries.ts:386-397.
  const { data: contracts, error: conErr } = await supabase
    .from("property_contracts")
    .select("id, unit_id, rent_pcm, status, start_date, vacate_date")
    .in("status", ["active", "signed", "notice_given", "terminated"]);
  if (conErr) throw new Error(conErr.message);

  // ── Rent payments in the month (income — actual cash) ──
  // NOTE: rent_payments.amount is numeric(10,2) in POUNDS, unlike pence everywhere else.
  // We multiply by 100 to convert to pence.
  const { data: rentPayments, error: payErr } = await supabase
    .from("rent_payments")
    .select("contract_id, unit_id, amount, period_year, period_month")
    .eq("period_year", year)
    .eq("period_month", month);
  if (payErr) throw new Error(payErr.message);

  // ── Property costs (all — filtered per month in JS) ──
  const { data: costsList, error: costErr } = await supabase
    .from("property_costs")
    .select("*");
  if (costErr) throw new Error(costErr.message);

  // ── Bank transactions in the month (reconciliation only) ──
  const { data: txnRows, error: txnErr } = await supabase
    .from("bank_transactions")
    .select("amount_pence, transaction_type, match_status, transaction_date")
    .gte("transaction_date", msStr)
    .lte("transaction_date", meStr);
  // Bank txns table may not exist in older deploys; treat as zero rather than throw.
  const txns = txnErr ? [] : (txnRows ?? []);

  // ── Business overheads (admin costs not tied to a property) ──
  const { data: overheadRows, error: ovErr } = await supabase
    .from("business_overheads")
    .select("*");
  const overheads = ovErr ? [] : ((overheadRows ?? []) as BusinessOverhead[]);

  // ── Tenant recurring charges (income on top of rent) ──
  const { data: tenantChargeRows, error: tcErr } = await supabase
    .from("tenant_recurring_charges")
    .select("amount, start_date, end_date, is_active");
  const tenantCharges = tcErr
    ? []
    : ((tenantChargeRows ?? []) as Array<{
        amount: number;
        start_date: string;
        end_date: string | null;
        is_active: boolean;
      }>);

  // ── Lookups ──
  const unitToProperty = new Map<string, string>();
  for (const u of units ?? []) unitToProperty.set(u.id, u.property_id);

  const portfolioInfo = new Map<string, { name: string; color: string }>();
  const propertyToPortfolio = new Map<string, string>();
  for (const p of props) {
    const port = Array.isArray(p.portfolios) ? p.portfolios[0] : p.portfolios;
    const pid = (port?.id as string | undefined) ?? p.portfolio_id ?? "unassigned";
    const pname = port?.name ?? "Unassigned";
    const pcolor = port?.color ?? "#6b7280";
    portfolioInfo.set(pid, { name: pname, color: pcolor });
    propertyToPortfolio.set(p.id, pid);
  }

  const propertyInfo = new Map<string, { name: string; portfolio_id: string }>();
  for (const p of props) {
    propertyInfo.set(p.id, {
      name: p.name,
      portfolio_id: propertyToPortfolio.get(p.id) ?? "unassigned",
    });
  }

  // ── Owner rent per property (pence) ──
  const ownerRentByProperty = new Map<string, number>();
  for (const p of props) {
    const divisor = p.payment_schedule ? SCHEDULE_DIVISOR[p.payment_schedule] ?? 1 : 1;
    ownerRentByProperty.set(
      p.id,
      Math.round((Number(p.monthly_rent_owed ?? 0) * 100) / divisor)
    );
  }

  // ── Property costs grouped by property ──
  const costsByProperty = new Map<string, PropertyCost[]>();
  for (const c of (costsList ?? []) as PropertyCost[]) {
    if (!costsByProperty.has(c.property_id)) costsByProperty.set(c.property_id, []);
    costsByProperty.get(c.property_id)!.push(c);
  }

  // ── Per-property aggregation ──
  const byPropertyMap = new Map<string, FinancePropertyBreakdown>();
  for (const p of props) {
    const portId = propertyToPortfolio.get(p.id) ?? "unassigned";
    const portInfo = portfolioInfo.get(portId) ?? { name: "Unassigned", color: "#6b7280" };
    byPropertyMap.set(p.id, {
      property_id: p.id,
      property_name: p.name,
      portfolio_id: portId,
      portfolio_name: portInfo.name,
      portfolio_color: portInfo.color,
      rent_expected: 0,
      rent_received: 0,
      property_costs: 0,
      owner_rent: ownerRentByProperty.get(p.id) ?? 0,
      net_profit: 0,
    });
  }

  // Expected rent — pro-rated by overlap days, per contract → per property
  for (const c of contracts ?? []) {
    const propertyId = unitToProperty.get(c.unit_id);
    if (!propertyId) continue;
    const row = byPropertyMap.get(propertyId);
    if (!row) continue;
    const cStart = c.start_date;
    const cEnd = c.vacate_date ?? meStr;
    if (!cStart) continue;
    if (cStart > meStr || cEnd < msStr) continue;
    const overlapStart = cStart > msStr ? cStart : msStr;
    const overlapEnd = cEnd < meStr ? cEnd : meStr;
    const daysActive =
      Math.floor((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000) + 1;
    const incomePence = Math.round(((c.rent_pcm ?? 0) * 100 * daysActive) / daysInMonth);
    row.rent_expected += incomePence;
  }

  // Received rent — sum of rent_payments for the month (pounds → pence)
  for (const p of rentPayments ?? []) {
    const propertyId = unitToProperty.get(p.unit_id);
    if (!propertyId) continue;
    const row = byPropertyMap.get(propertyId);
    if (!row) continue;
    row.rent_received += Math.round(Number(p.amount) * 100);
  }

  // Property costs by month
  const costsByCategoryMap = new Map<string, number>();
  for (const p of props) {
    const propCosts = costsByProperty.get(p.id) ?? [];
    const row = byPropertyMap.get(p.id)!;
    for (const c of propCosts) {
      const amt = costAmountForMonth(c, msStr, meStr);
      if (!amt) continue;
      row.property_costs += amt;
      costsByCategoryMap.set(c.cost_type, (costsByCategoryMap.get(c.cost_type) ?? 0) + amt);
    }
  }

  // Business overheads (admin) — not tied to any property, kept on the
  // portfolio-wide total only.
  let adminOverheadsTotal = 0;
  const overheadsByCategoryMap = new Map<string, number>();
  for (const o of overheads) {
    const amt = costAmountForMonth(o, msStr, meStr);
    if (!amt) continue;
    adminOverheadsTotal += amt;
    overheadsByCategoryMap.set(o.category, (overheadsByCategoryMap.get(o.category) ?? 0) + amt);
  }

  // Tenant recurring charges expected for the month (income on top of rent).
  let tenantChargesExpected = 0;
  for (const c of tenantCharges) {
    if (!chargeActiveInMonth(c, msStr, meStr)) continue;
    tenantChargesExpected += c.amount;
  }

  // Vacancy loss — current month only, mirrors src/features/profitability/data/queries.ts:151-162
  let vacancyLoss = 0;
  if (isCurrentMonth) {
    const tStr = todayIso();
    for (const u of units ?? []) {
      const isVacant =
        VACANT_STATUSES.has(u.status) ||
        (u.status === "move_out" && (u.available_date ?? "") <= tStr);
      if (!isVacant) continue;
      const daysVacant = u.available_date
        ? Math.max(
            0,
            Math.floor((new Date(tStr).getTime() - new Date(u.available_date).getTime()) / 86400000)
          )
        : 0;
      const dailyRate = Math.round(((u.max_price_pcm ?? 0) * 100) / 30);
      vacancyLoss += daysVacant * dailyRate;
    }
  }

  // Build per-property net_profit (cash basis: received - costs - owner_rent)
  for (const row of byPropertyMap.values()) {
    row.net_profit = row.rent_received - row.property_costs - row.owner_rent;
  }

  // Per-portfolio rollup
  const byPortfolioMap = new Map<string, FinancePortfolioBreakdown>();
  for (const row of byPropertyMap.values()) {
    let p = byPortfolioMap.get(row.portfolio_id);
    if (!p) {
      p = {
        portfolio_id: row.portfolio_id,
        portfolio_name: row.portfolio_name,
        portfolio_color: row.portfolio_color,
        rent_expected: 0,
        rent_received: 0,
        property_costs: 0,
        owner_rent: 0,
        net_profit: 0,
      };
      byPortfolioMap.set(row.portfolio_id, p);
    }
    p.rent_expected += row.rent_expected;
    p.rent_received += row.rent_received;
    p.property_costs += row.property_costs;
    p.owner_rent += row.owner_rent;
    p.net_profit += row.net_profit;
  }

  // Totals
  const rentExpectedTotal = [...byPropertyMap.values()].reduce((s, r) => s + r.rent_expected, 0);
  const rentReceivedTotal = [...byPropertyMap.values()].reduce((s, r) => s + r.rent_received, 0);
  const propertyCostsTotal = [...byPropertyMap.values()].reduce((s, r) => s + r.property_costs, 0);
  const ownerRentTotal = [...byPropertyMap.values()].reduce((s, r) => s + r.owner_rent, 0);
  const totalCosts = propertyCostsTotal + ownerRentTotal + adminOverheadsTotal;
  const netProfit = rentReceivedTotal - totalCosts - vacancyLoss;

  // Bank credits in month
  let bankCreditsTotal = 0;
  let bankCreditsMatched = 0;
  for (const t of txns ?? []) {
    if (t.transaction_type !== "credit") continue;
    bankCreditsTotal += t.amount_pence ?? 0;
    if (t.match_status === "matched") bankCreditsMatched += t.amount_pence ?? 0;
  }

  // Costs-by-category includes owner rent + admin overheads as their own
  // lines for visibility on the hub.
  const costsByCategory: FinanceCostCategoryBreakdown[] = [];
  if (ownerRentTotal > 0) {
    costsByCategory.push({ key: "owner_rent", label: "Owner Rent", amount: ownerRentTotal });
  }
  for (const [key, amount] of costsByCategoryMap.entries()) {
    const label = COST_TYPE_LABELS[key as keyof typeof COST_TYPE_LABELS] ?? key;
    costsByCategory.push({ key, label, amount });
  }
  for (const [key, amount] of overheadsByCategoryMap.entries()) {
    const label = `Admin · ${
      OVERHEAD_CATEGORY_LABELS[key as keyof typeof OVERHEAD_CATEGORY_LABELS] ?? key
    }`;
    costsByCategory.push({ key: `overhead:${key}`, label, amount });
  }
  costsByCategory.sort((a, b) => b.amount - a.amount);

  const byPortfolio = [...byPortfolioMap.values()].sort((a, b) => b.net_profit - a.net_profit);
  const byProperty = [...byPropertyMap.values()].sort((a, b) => b.net_profit - a.net_profit);

  return {
    year,
    month,
    month_key: `${year}-${String(month).padStart(2, "0")}` as MonthKey,
    month_label: monthLabel(year, month),
    is_current_month: isCurrentMonth,
    is_future_month: isFutureMonth,
    rent_expected: rentExpectedTotal,
    rent_received: rentReceivedTotal,
    rent_outstanding: Math.max(0, rentExpectedTotal - rentReceivedTotal),
    tenant_charges_expected: tenantChargesExpected,
    property_costs: propertyCostsTotal,
    owner_rent: ownerRentTotal,
    admin_overheads: adminOverheadsTotal,
    total_costs: totalCosts,
    vacancy_loss: vacancyLoss,
    net_profit: netProfit,
    bank_credits_total: bankCreditsTotal,
    bank_credits_matched: bankCreditsMatched,
    bank_credits_unmatched: bankCreditsTotal - bankCreditsMatched,
    by_portfolio: byPortfolio,
    by_property: byProperty,
    costs_by_category: costsByCategory,
  };
}
