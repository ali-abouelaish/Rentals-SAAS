"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PropertyProfitability,
  PropertyCost,
  ProfitabilityAlert,
  DashboardData,
  DashboardPropertySummary,
  DashboardAction,
  DashboardActionSeverity,
  CollectionSummary,
  PortfolioMonthPoint,
  PropertyMonthPoint,
  UnitProfitRow,
} from "../domain/types";
import { getMaintenanceSummary } from "@/features/maintenance/data/queries";
import { getRentCollectionRows } from "@/features/rent-collection/data/queries";
import type { RentCollectionRow } from "@/features/rent-collection/data/queries";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Days between two date strings (or date → today) */
function daysBetween(from: string, to?: string): number {
  const a = new Date(from);
  const b = to ? new Date(to) : new Date();
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

/** Today as YYYY-MM-DD */
function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** First day of month as YYYY-MM-DD */
function startOfMonth(monthsAgo = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString().split("T")[0];
}

/** Calculate the monthly amount of an amortised cost for a given period */
function amortisedMonthlyAmount(cost: PropertyCost): number {
  if (cost.cost_mode !== "amortised" || !cost.amortise_months || !cost.amortise_start_date) return 0;
  const start = new Date(cost.amortise_start_date);
  const end = new Date(cost.amortise_start_date);
  end.setMonth(end.getMonth() + cost.amortise_months);
  const now = new Date();
  if (now < start || now > end) return 0;
  return Math.round(cost.amount / cost.amortise_months);
}

/** Compute total costs in pence for a property for the current month */
function computeMonthlyCosts(costs: PropertyCost[]): number {
  const periodStart = startOfMonth(0);
  const periodEnd = today();

  return costs.reduce((sum, c) => {
    if (c.cost_mode === "recurring") return sum + c.amount;
    if (c.cost_mode === "amortised") return sum + amortisedMonthlyAmount(c);
    // one_off — only if date_incurred is within this month
    if (c.date_incurred >= periodStart && c.date_incurred <= periodEnd) return sum + c.amount;
    return sum;
  }, 0);
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

/** Raw inputs for property profitability, fetched in parallel. Shared between
 *  getAllPropertyProfitabilities and getDashboardData so the dashboard doesn't
 *  re-query units/contracts. */
async function fetchProfitabilityInputs() {
  const supabase = createSupabaseServerClient();

  const [
    { data: properties, error: propErr },
    { data: units, error: unitErr },
    { data: contracts, error: conErr },
    { data: allContracts, error: allConErr },
    { data: costs, error: costErr },
    { data: targets, error: targErr },
  ] = await Promise.all([
    // Properties + portfolios + owner landlord rent details
    supabase
      .from("properties")
      .select(
        "id, name, portfolio_id, monthly_rent_owed, payment_schedule, contract_start_date, portfolios(id, name, color), owner_landlord:owner_landlords(id, name)"
      )
      .order("name"),
    // Units with pm_tenant names
    supabase
      .from("units")
      .select(
        "id, property_id, unit_type, room_number, room_type, status, available_date, max_price_pcm, pm_tenant_id, pm_tenants(full_name)"
      ),
    // Active contracts (for income + dashboard move-outs). vacate_date /
    // notice_given_date are only used by the dashboard but cost nothing extra
    // to select here, letting both callers share this one query.
    supabase
      .from("property_contracts")
      .select("unit_id, rent_pcm, status, vacate_date, notice_given_date")
      .in("status", ["active", "notice_given", "signed"]),
    // All contracts ever (for earliest tenant start_date per unit) — used to
    // compute pre-let vacant days from property's owner-landlord contract start.
    supabase.from("property_contracts").select("unit_id, start_date"),
    // Costs
    supabase.from("property_costs").select("*"),
    // Targets
    supabase.from("property_targets").select("property_id, target_profit_pcm"),
  ]);

  if (propErr) throw propErr;
  if (unitErr) throw unitErr;
  if (conErr) throw conErr;
  if (allConErr) throw allConErr;
  if (costErr) throw costErr;
  if (targErr) throw targErr;

  return {
    properties: properties ?? [],
    units: units ?? [],
    contracts: contracts ?? [],
    allContracts: allContracts ?? [],
    costs: costs ?? [],
    targets: targets ?? [],
  };
}

type ProfitabilityInputs = Awaited<ReturnType<typeof fetchProfitabilityInputs>>;

/** Compute per-property P&L from pre-fetched inputs. Pure (no I/O). */
function computeProfitabilities(inputs: ProfitabilityInputs): PropertyProfitability[] {
  const { properties, units, contracts, allContracts, costs, targets } = inputs;
  if (!properties.length) return [];

  // unit_id → rent_pcm (pence). Falls back to units.max_price_pcm × 100 below
  // when there's no active contract — handles rent-roll imports that haven't
  // backfilled property_contracts.
  const contractMap = new Map<string, number>();
  for (const c of contracts) {
    contractMap.set(c.unit_id, (c.rent_pcm ?? 0) * 100);
  }
  // unit_id → earliest start_date string (YYYY-MM-DD comparisons are safe)
  const earliestStartMap = new Map<string, string>();
  for (const c of allContracts) {
    if (!c.start_date) continue;
    const existing = earliestStartMap.get(c.unit_id);
    if (!existing || c.start_date < existing) {
      earliestStartMap.set(c.unit_id, c.start_date);
    }
  }
  const costsMap = new Map<string, PropertyCost[]>();
  for (const c of costs) {
    if (!costsMap.has(c.property_id)) costsMap.set(c.property_id, []);
    costsMap.get(c.property_id)!.push(c as PropertyCost);
  }
  const targetMap = new Map<string, number>();
  for (const t of targets) {
    targetMap.set(t.property_id, t.target_profit_pcm * 100);
  }
  // property_id → its units, indexed once to avoid an O(properties × units)
  // scan inside the map below.
  const unitsByProperty = new Map<string, typeof units>();
  for (const u of units) {
    const list = unitsByProperty.get(u.property_id);
    if (list) list.push(u);
    else unitsByProperty.set(u.property_id, [u]);
  }

  const occupiedStatuses = new Set(["occupied", "renewal"]);

  return properties.map((prop) => {
    const portfolio = Array.isArray(prop.portfolios) ? prop.portfolios[0] : prop.portfolios;
    const propUnits = unitsByProperty.get(prop.id) ?? [];
    const propCosts = costsMap.get(prop.id) ?? [];
    const propContractStart = (prop.contract_start_date as string | null) ?? null;

    const unit_breakdown: UnitProfitRow[] = propUnits.map((u) => {
      const isVacant =
        ["available", "on_hold"].includes(u.status) ||
        (u.status === "move_out" && (u.available_date ?? "") <= today());
      const contractRent = contractMap.get(u.id);
      const rentPcm = contractRent !== undefined
        ? contractRent
        : occupiedStatuses.has(u.status)
          ? (u.max_price_pcm ?? 0) * 100
          : 0;
      const daysVacant = isVacant && u.available_date ? daysBetween(u.available_date) : 0;
      const dailyRate = Math.round((u.max_price_pcm ?? 0) * 100 / 30);
      const vacancyLoss = daysVacant * dailyRate;
      const tenantRecord = Array.isArray(u.pm_tenants) ? u.pm_tenants[0] : u.pm_tenants;
      const roomLabel = u.unit_type === "room" && u.room_number
        ? `Room ${u.room_number}${u.room_type ? ` · ${u.room_type.charAt(0).toUpperCase() + u.room_type.slice(1)}` : ""}`
        : u.unit_type === "studio" ? "Studio" : "Whole Flat";

      // Pre-let vacant days: from property's owner-landlord contract start
      // until the room's earliest tenant contract start (or today if never let).
      let preLetDays: number | null = null;
      let preLetLoss = 0;
      let preLetPeriodStart: string | null = null;
      let preLetPeriodEnd: string | null = null;
      if (propContractStart) {
        const earliestTenantStart = earliestStartMap.get(u.id);
        const endDate = earliestTenantStart ?? today();
        if (endDate >= propContractStart) {
          preLetDays = daysBetween(propContractStart, endDate);
        } else {
          preLetDays = 0;
        }
        if (preLetDays > 0) {
          preLetPeriodStart = propContractStart;
          preLetPeriodEnd = endDate;
        }
        // Only book pre-let loss when the room has actually been let since —
        // for never-let rooms the existing vacancy_loss (driven by
        // available_date) already covers it, so we'd double count.
        if (preLetDays > 0 && earliestTenantStart) {
          preLetLoss = preLetDays * dailyRate;
        }
      }

      return {
        unit_id: u.id,
        unit_label: roomLabel,
        tenant_name: (tenantRecord as { full_name?: string } | null)?.full_name ?? null,
        rent_pcm: rentPcm,
        days_vacant: daysVacant,
        vacancy_loss: vacancyLoss,
        net_contribution: rentPcm,
        status: u.status,
        pre_let_days: preLetDays,
        pre_let_loss: preLetLoss,
        pre_let_period_start: preLetPeriodStart,
        pre_let_period_end: preLetPeriodEnd,
        vacant_since: isVacant && u.available_date ? u.available_date : null,
      };
    });

    const total_income = unit_breakdown.reduce((s, u) => s + u.rent_pcm, 0);
    const scheduleDivisor: Record<NonNullable<typeof prop.payment_schedule>, number> = {
      monthly: 1,
      quarterly: 3,
      biannual: 6,
      annual: 12,
    };
    const ownerRentRaw = prop.monthly_rent_owed ?? 0;
    const divisor = prop.payment_schedule ? scheduleDivisor[prop.payment_schedule] : 1;
    const owner_rent_monthly = Math.round((Number(ownerRentRaw) * 100) / divisor);
    const total_costs = computeMonthlyCosts(propCosts) + owner_rent_monthly;
    const vacancy_loss = unit_breakdown.reduce((s, u) => s + u.vacancy_loss, 0);
    const total_pre_let_loss = unit_breakdown.reduce((s, u) => s + u.pre_let_loss, 0);
    const net_profit = total_income - total_costs - vacancy_loss - total_pre_let_loss;
    const target_profit = targetMap.get(prop.id) ?? null;
    const ownerLandlord = Array.isArray(prop.owner_landlord)
      ? prop.owner_landlord[0]
      : prop.owner_landlord;

    return {
      property_id: prop.id,
      property_name: prop.name,
      portfolio_id: prop.portfolio_id ?? "",
      portfolio_name: (portfolio as { name?: string } | null)?.name ?? "Unknown",
      portfolio_color: (portfolio as { color?: string } | null)?.color ?? "#6b7280",
      total_units: propUnits.length,
      occupied_units: propUnits.filter((u) => occupiedStatuses.has(u.status)).length,
      total_income,
      total_costs,
      vacancy_loss,
      net_profit,
      target_profit,
      vs_target: target_profit !== null ? net_profit - target_profit : null,
      last_month_net_profit: null,
      trend: null,
      unit_breakdown,
      costs: propCosts,
      owner_rent_monthly,
      owner_landlord_name: (ownerLandlord as { name?: string } | null)?.name ?? null,
      owner_payment_schedule: prop.payment_schedule ?? null,
      property_contract_start_date: propContractStart,
      total_pre_let_days: unit_breakdown.reduce((s, u) => s + (u.pre_let_days ?? 0), 0),
      total_pre_let_loss,
    };
  });
}

/** Fetch all property profitabilities for the current tenant, current month. */
export async function getAllPropertyProfitabilities(): Promise<PropertyProfitability[]> {
  return computeProfitabilities(await fetchProfitabilityInputs());
}

/** Fetch profitability detail for a single property. */
export async function getPropertyProfitability(propertyId: string): Promise<PropertyProfitability | null> {
  const all = await getAllPropertyProfitabilities();
  return all.find((p) => p.property_id === propertyId) ?? null;
}

/** Fetch all unresolved alerts for this tenant. */
export async function getProfitabilityAlerts(): Promise<ProfitabilityAlert[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profitability_alerts")
    .select(
      `*, properties(name, portfolio_id, portfolios(name, color)), units(unit_type, room_number, room_type)`
    )
    .eq("is_resolved", false)
    .order("triggered_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((a) => {
    const prop = Array.isArray(a.properties) ? a.properties[0] : a.properties;
    const port = prop?.portfolios
      ? Array.isArray(prop.portfolios) ? prop.portfolios[0] : prop.portfolios
      : null;
    const unit = Array.isArray(a.units) ? a.units[0] : a.units;
    let unitLabel: string | null = null;
    if (unit) {
      if (unit.unit_type === "room" && unit.room_number) {
        unitLabel = `Room ${unit.room_number}${unit.room_type ? ` · ${unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)}` : ""}`;
      } else {
        unitLabel = unit.unit_type === "studio" ? "Studio" : "Whole Flat";
      }
    }
    return {
      ...a,
      property_name: (prop as { name?: string } | null)?.name ?? "Unknown",
      portfolio_name: (port as { name?: string } | null)?.name ?? "Unknown",
      portfolio_color: (port as { color?: string } | null)?.color ?? "#6b7280",
      unit_label: unitLabel,
    } as ProfitabilityAlert;
  });
}

/** Fetch costs for a single property. */
export async function getPropertyCosts(propertyId: string): Promise<PropertyCost[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("property_costs")
    .select("*")
    .eq("property_id", propertyId)
    .order("date_incurred", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyCost[];
}

/** Build a per-property monthly trend (income / costs / net profit) for the past N months.
 *
 * Approximations:
 *   - Income is pro-rated daily based on contract start_date / vacate_date overlap.
 *   - Recurring costs are assumed active throughout (no historical activation dates).
 *   - Amortised costs apply only within their amortisation window.
 *   - One-off costs apply only in the month of date_incurred.
 *   - Vacancy loss is not computed historically (no historical unit-state log).
 */
export async function getPropertyMonthlyTrend(
  propertyId: string,
  months = 12
): Promise<PropertyMonthPoint[]> {
  const supabase = createSupabaseServerClient();

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, monthly_rent_owed, payment_schedule")
    .eq("id", propertyId)
    .single();
  if (propErr || !property) return [];

  const { data: unitRows } = await supabase
    .from("units")
    .select("id")
    .eq("property_id", propertyId);
  const unitIds = (unitRows ?? []).map((u) => u.id);

  const [contractsRes, costsRes] = await Promise.all([
    unitIds.length
      ? supabase
          .from("property_contracts")
          .select("unit_id, rent_pcm, status, start_date, vacate_date")
          .in("unit_id", unitIds)
          .in("status", ["active", "signed", "notice_given", "terminated"])
      : Promise.resolve({ data: [] as Array<{ unit_id: string; rent_pcm: number; status: string; start_date: string; vacate_date: string | null }> }),
    supabase
      .from("property_costs")
      .select("*")
      .eq("property_id", propertyId),
  ]);
  const contracts = (contractsRes.data ?? []) as Array<{
    unit_id: string;
    rent_pcm: number;
    status: string;
    start_date: string;
    vacate_date: string | null;
  }>;
  const costsList = (costsRes.data ?? []) as PropertyCost[];

  const scheduleDivisor: Record<"monthly" | "quarterly" | "biannual" | "annual", number> = {
    monthly: 1,
    quarterly: 3,
    biannual: 6,
    annual: 12,
  };
  const ownerRentRaw = property.monthly_rent_owed ?? 0;
  const divisor = property.payment_schedule
    ? scheduleDivisor[property.payment_schedule as keyof typeof scheduleDivisor]
    : 1;
  const ownerRentMonthlyPence = Math.round((Number(ownerRentRaw) * 100) / divisor);

  const result: PropertyMonthPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const msStr = monthStart.toISOString().split("T")[0];
    const meStr = monthEnd.toISOString().split("T")[0];

    // Income (pence) — pro-rated by overlap days
    let incomePence = 0;
    for (const c of contracts) {
      const cStart = c.start_date;
      const cEnd = c.vacate_date ?? meStr;
      if (cStart > meStr || cEnd < msStr) continue;
      const overlapStart = cStart > msStr ? cStart : msStr;
      const overlapEnd = cEnd < meStr ? cEnd : meStr;
      const daysActive =
        Math.floor(
          (new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000
        ) + 1;
      incomePence += Math.round(((c.rent_pcm ?? 0) * 100 * daysActive) / daysInMonth);
    }

    // Costs (pence)
    let costsPence = ownerRentMonthlyPence;
    for (const c of costsList) {
      if (c.cost_mode === "recurring") {
        costsPence += c.amount;
      } else if (c.cost_mode === "amortised") {
        if (!c.amortise_months || !c.amortise_start_date) continue;
        const aStart = new Date(c.amortise_start_date);
        const aEnd = new Date(aStart);
        aEnd.setMonth(aEnd.getMonth() + c.amortise_months);
        if (monthStart >= aStart && monthStart < aEnd) {
          costsPence += Math.round(c.amount / c.amortise_months);
        }
      } else if (c.date_incurred >= msStr && c.date_incurred <= meStr) {
        costsPence += c.amount;
      }
    }

    const monthLabel = monthStart.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
    });
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

    result.push({
      month: monthLabel,
      month_key: monthKey,
      income: Math.round(incomePence / 100),
      costs: Math.round(costsPence / 100),
      net_profit: Math.round((incomePence - costsPence) / 100),
    });
  }

  return result;
}

/** Build the portfolio line graph data for the past N months.
 *
 * Approximations (mirror getPropertyMonthlyTrend so the per-property and
 * per-portfolio views stay consistent):
 *   - Income is pro-rated daily based on contract start_date / vacate_date overlap.
 *   - Owner rent is added every month (no historical activation date tracked).
 *   - Recurring costs are assumed active throughout.
 *   - Amortised costs apply only within their amortisation window.
 *   - One-off costs apply only in the month of date_incurred.
 *   - Vacancy loss is not subtracted historically (no historical unit-state log).
 */
export async function getPortfolioGraphData(months = 12): Promise<PortfolioMonthPoint[]> {
  const supabase = createSupabaseServerClient();

  const { data: properties, error: propErr } = await supabase
    .from("properties")
    .select("id, monthly_rent_owed, payment_schedule, portfolios(id, name, color)");
  if (propErr) throw propErr;
  if (!properties?.length) return [];

  const { data: units, error: unitErr } = await supabase
    .from("units")
    .select("id, property_id");
  if (unitErr) throw unitErr;

  const unitIds = (units ?? []).map((u) => u.id);
  const contractsRes = unitIds.length
    ? await supabase
        .from("property_contracts")
        .select("unit_id, rent_pcm, status, start_date, vacate_date")
        .in("unit_id", unitIds)
        .in("status", ["active", "signed", "notice_given", "terminated"])
    : { data: [] as Array<{ unit_id: string; rent_pcm: number; status: string; start_date: string; vacate_date: string | null }>, error: null };
  if (contractsRes.error) throw contractsRes.error;
  const contracts = contractsRes.data ?? [];

  const { data: costsList, error: costErr } = await supabase
    .from("property_costs")
    .select("*");
  if (costErr) throw costErr;

  // Lookups
  const unitToProperty = new Map<string, string>();
  for (const u of units ?? []) unitToProperty.set(u.id, u.property_id);

  const propertyToPortfolio = new Map<string, string>();
  const portfolioNames = new Set<string>();
  for (const p of properties) {
    const portfolio = Array.isArray(p.portfolios) ? p.portfolios[0] : p.portfolios;
    const name = (portfolio as { name?: string } | null)?.name ?? "Unknown";
    propertyToPortfolio.set(p.id, name);
    portfolioNames.add(name);
  }

  const scheduleDivisor: Record<"monthly" | "quarterly" | "biannual" | "annual", number> = {
    monthly: 1,
    quarterly: 3,
    biannual: 6,
    annual: 12,
  };
  const ownerRentByProperty = new Map<string, number>();
  for (const p of properties) {
    const divisor = p.payment_schedule
      ? scheduleDivisor[p.payment_schedule as keyof typeof scheduleDivisor] ?? 1
      : 1;
    ownerRentByProperty.set(
      p.id,
      Math.round((Number(p.monthly_rent_owed ?? 0) * 100) / divisor)
    );
  }

  const costsByProperty = new Map<string, PropertyCost[]>();
  for (const c of (costsList ?? []) as PropertyCost[]) {
    if (!costsByProperty.has(c.property_id)) costsByProperty.set(c.property_id, []);
    costsByProperty.get(c.property_id)!.push(c);
  }

  const result: PortfolioMonthPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const msStr = monthStart.toISOString().split("T")[0];
    const meStr = monthEnd.toISOString().split("T")[0];

    const incomeByPortfolio = new Map<string, number>();
    const costsByPortfolio = new Map<string, number>();
    for (const name of portfolioNames) {
      incomeByPortfolio.set(name, 0);
      costsByPortfolio.set(name, 0);
    }

    // Income (pence) — pro-rated by overlap days
    for (const c of contracts) {
      const propertyId = unitToProperty.get(c.unit_id);
      if (!propertyId) continue;
      const portfolioName = propertyToPortfolio.get(propertyId);
      if (!portfolioName) continue;

      const cStart = c.start_date;
      const cEnd = c.vacate_date ?? meStr;
      if (cStart > meStr || cEnd < msStr) continue;
      const overlapStart = cStart > msStr ? cStart : msStr;
      const overlapEnd = cEnd < meStr ? cEnd : meStr;
      const daysActive =
        Math.floor(
          (new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000
        ) + 1;
      const incomePence = Math.round(((c.rent_pcm ?? 0) * 100 * daysActive) / daysInMonth);
      incomeByPortfolio.set(portfolioName, (incomeByPortfolio.get(portfolioName) ?? 0) + incomePence);
    }

    // Costs (pence) — owner rent + property_costs
    for (const p of properties) {
      const portfolioName = propertyToPortfolio.get(p.id);
      if (!portfolioName) continue;

      let propCostPence = ownerRentByProperty.get(p.id) ?? 0;
      const propCosts = costsByProperty.get(p.id) ?? [];
      for (const c of propCosts) {
        if (c.cost_mode === "recurring") {
          propCostPence += c.amount;
        } else if (c.cost_mode === "amortised") {
          if (!c.amortise_months || !c.amortise_start_date) continue;
          const aStart = new Date(c.amortise_start_date);
          const aEnd = new Date(aStart);
          aEnd.setMonth(aEnd.getMonth() + c.amortise_months);
          if (monthStart >= aStart && monthStart < aEnd) {
            propCostPence += Math.round(c.amount / c.amortise_months);
          }
        } else if (c.date_incurred >= msStr && c.date_incurred <= meStr) {
          propCostPence += c.amount;
        }
      }
      costsByPortfolio.set(portfolioName, (costsByPortfolio.get(portfolioName) ?? 0) + propCostPence);
    }

    const monthLabel = monthStart.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
    });

    const point: PortfolioMonthPoint = { month: monthLabel };
    for (const name of portfolioNames) {
      const income = incomeByPortfolio.get(name) ?? 0;
      const costs = costsByPortfolio.get(name) ?? 0;
      point[name] = Math.round((income - costs) / 100); // £
    }
    result.push(point);
  }

  return result;
}

/** Dashboard aggregate data. Pass `isAdmin` so rent-collection/arrears (which
 *  is admin-scoped) is only fetched for viewers allowed to see it. */
export async function getDashboardData(
  opts: { isAdmin?: boolean } = {}
): Promise<DashboardData> {
  // Fetch the shared profitability inputs once (properties/units/contracts/…)
  // in parallel with alerts + maintenance + rent-collection, then compute the
  // P&L from those same rows. The dashboard no longer issues its own
  // units/contracts queries.
  const [inputs, alerts, maintenanceSummary, rentRows] = await Promise.all([
    fetchProfitabilityInputs(),
    getProfitabilityAlerts(),
    getMaintenanceSummary(),
    opts.isAdmin
      ? getRentCollectionRows().catch(() => [] as RentCollectionRow[])
      : Promise.resolve([] as RentCollectionRow[]),
  ]);

  const properties = computeProfitabilities(inputs);
  const contracts = inputs.contracts;

  type UnitRow = {
    id: string;
    property_id: string;
    unit_type: string;
    room_number: string | null;
    room_type: string | null;
    status: string;
    available_date: string | null;
    max_price_pcm: number | null;
    pm_tenant_id: string | null;
    pm_tenants: { full_name: string } | { full_name: string }[] | null;
  };
  const units = inputs.units as UnitRow[];

  // Status taxonomy:
  //   • occupied / renewal       → unit currently has a tenant
  //   • available / on_hold / move_out / replacement / booked → vacant (no
  //     active tenant for revenue purposes; "booked" rooms are reserved
  //     but not yet earning rent)
  const occupiedStatuses = new Set(["occupied", "renewal"]);
  const vacantStatuses = new Set([
    "available",
    "on_hold",
    "move_out",
    "replacement",
    "booked",
  ]);

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => occupiedStatuses.has(u.status)).length;
  const vacantUnitsList = units.filter((u) => vacantStatuses.has(u.status));
  const vacantUnits = vacantUnitsList.length;

  // Rent roll: prefer property_contracts when available, otherwise fall back
  // to summing max_price_pcm of currently-occupied units (handles imported
  // rent-rolls where contracts haven't been backfilled yet).
  const activeContractRoll = contracts
    .filter((c) => c.status === "active" || c.status === "signed")
    .reduce((s, c) => s + (c.rent_pcm ?? 0), 0);
  const totalRentRoll = activeContractRoll > 0
    ? activeContractRoll
    : units
        .filter((u) => occupiedStatuses.has(u.status))
        .reduce((s, u) => s + (u.max_price_pcm ?? 0), 0);

  const dailyLoss = vacantUnitsList.reduce(
    (s, u) => s + Math.round((u.max_price_pcm ?? 0) / 30),
    0
  );

  const propIndex = new Map(properties.map((p) => [p.property_id, p] as const));
  const vacancyStatusOf = (s: string): "vacant" | "move_out" | "replacement" =>
    s === "move_out" ? "move_out" : s === "replacement" ? "replacement" : "vacant";
  const labelOf = (u: UnitRow) =>
    u.unit_type === "room" && u.room_number
      ? `Room ${u.room_number}${u.room_type ? ` · ${u.room_type.charAt(0).toUpperCase() + u.room_type.slice(1)}` : ""}`
      : u.unit_type === "studio"
        ? "Studio"
        : "Whole Flat";
  const tenantNameOf = (u: UnitRow): string | null => {
    const t = Array.isArray(u.pm_tenants) ? u.pm_tenants[0] : u.pm_tenants;
    return t?.full_name ?? null;
  };

  // Build the Vacancy Overview list from real units.
  const vacancy_units = vacantUnitsList.map((u) => {
    const prop = propIndex.get(u.property_id);
    const dailyRate = Math.round((u.max_price_pcm ?? 0) / 30);
    const daysVacant = u.available_date ? daysBetween(u.available_date) : 0;
    return {
      unit_id: u.id,
      unit_label: labelOf(u),
      property_id: u.property_id,
      property_name: prop?.property_name ?? "—",
      portfolio_name: prop?.portfolio_name ?? "—",
      portfolio_color: prop?.portfolio_color ?? "#6b7280",
      status: vacancyStatusOf(u.status),
      days_vacant: daysVacant,
      days_until_vacant: null,
      daily_loss: dailyRate,
      total_loss: daysVacant * dailyRate,
    };
  });

  // Build Upcoming Move-Outs from real data:
  //   1. property_contracts with vacate_date set (notice given)
  //   2. fallback: occupied/renewal units with a future available_date (the
  //      contract end date carried from the rent-roll import)
  const todayStr = today();
  const noticeContracts = contracts.filter(
    (c) => c.status === "notice_given" && c.vacate_date && c.vacate_date >= todayStr
  );
  const noticeUnitIds = new Set(noticeContracts.map((c) => c.unit_id));
  const unitById = new Map(units.map((u) => [u.id, u] as const));

  const upcoming_move_outs = [
    ...noticeContracts.map((c) => {
      const u = unitById.get(c.unit_id);
      return {
        unit_id: c.unit_id,
        unit_label: u ? labelOf(u) : "—",
        property_id: u?.property_id ?? "",
        property_name: (u && propIndex.get(u.property_id)?.property_name) ?? "—",
        tenant_name: u ? tenantNameOf(u) : null,
        vacate_date: c.vacate_date as string,
        days_remaining: daysBetween(todayStr, c.vacate_date as string),
        contract_status: "notice_given",
      };
    }),
    ...units
      .filter(
        (u) =>
          occupiedStatuses.has(u.status) &&
          u.available_date &&
          u.available_date >= todayStr &&
          !noticeUnitIds.has(u.id)
      )
      .map((u) => ({
        unit_id: u.id,
        unit_label: labelOf(u),
        property_id: u.property_id,
        property_name: propIndex.get(u.property_id)?.property_name ?? "—",
        tenant_name: tenantNameOf(u),
        vacate_date: u.available_date as string,
        days_remaining: daysBetween(todayStr, u.available_date as string),
        contract_status: u.status,
      })),
  ]
    .sort((a, b) => a.vacate_date.localeCompare(b.vacate_date))
    .slice(0, 10);

  const sorted = [...properties].sort((a, b) => b.net_profit - a.net_profit);
  const totalNetProfit = properties.reduce((s, p) => s + p.net_profit, 0);
  const toSummary = (p: PropertyProfitability): DashboardPropertySummary => ({
    property_id: p.property_id,
    property_name: p.property_name,
    portfolio_name: p.portfolio_name,
    portfolio_color: p.portfolio_color,
    net_profit: p.net_profit,
  });

  // ── Rent-collection health (admin only) ──────────────────
  const arrearsRows = rentRows.filter((r) => r.arrears > 0);
  const collection: CollectionSummary | null = opts.isAdmin
    ? {
        total_tenancies: rentRows.length,
        tenants_behind: arrearsRows.length,
        arrears_total: arrearsRows.reduce((s, r) => s + r.arrears, 0),
        collected_pct:
          rentRows.length > 0
            ? Math.round(
                (rentRows.filter((r) => r.currentMonthPaid).length / rentRows.length) * 100
              )
            : 100,
      }
    : null;

  // ── Prioritised "needs attention" action queue ───────────
  const actions = buildDashboardActions({
    arrearsRows,
    alerts,
    upcomingMoveOuts: upcoming_move_outs,
    vacancyUnits: vacancy_units,
    criticalJobs: maintenanceSummary.critical_jobs,
  });

  // Money currently at risk: outstanding arrears + vacancy already lost.
  const vacancyLossTotal = vacancy_units.reduce((s, v) => s + v.total_loss, 0);
  const atRiskTotal = (collection?.arrears_total ?? 0) + vacancyLossTotal;

  return {
    total_units: totalUnits,
    occupied_units: occupiedUnits,
    vacant_units: vacantUnits,
    daily_vacancy_loss: dailyLoss,
    total_rent_roll: totalRentRoll,
    alerts,
    vacancy_units,
    upcoming_move_outs,
    top_properties: sorted.slice(0, 3).map(toSummary),
    worst_properties: sorted.slice(-3).reverse().map(toSummary),
    portfolio_net_profit_this_month: Math.round(totalNetProfit / 100),
    portfolio_net_profit_last_month: 0,
    maintenance_summary: maintenanceSummary,
    actions,
    collection,
    at_risk_total: atRiskTotal,
  };
}

// ──────────────────────────────────────────────────────────
// Action queue builder
// ──────────────────────────────────────────────────────────

// Lower = shown first. Legal/safety deadlines outrank money, which outranks
// operational churn, which outranks review-only signals.
const ACTION_CATEGORY_RANK: Record<DashboardAction["category"], number> = {
  deposit: 0,
  maintenance: 1,
  arrears: 2,
  move_out: 3,
  vacancy: 4,
  contract: 5,
  cost: 6,
};
const ACTION_SEVERITY_RANK: Record<DashboardActionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

type ActionBuilderInput = {
  arrearsRows: RentCollectionRow[];
  alerts: ProfitabilityAlert[];
  upcomingMoveOuts: DashboardData["upcoming_move_outs"];
  vacancyUnits: DashboardData["vacancy_units"];
  criticalJobs: number;
};

function buildDashboardActions(input: ActionBuilderInput): DashboardAction[] {
  const { arrearsRows, alerts, upcomingMoveOuts, vacancyUnits, criticalJobs } = input;
  const actions: DashboardAction[] = [];

  // 1. Rent arrears — biggest / most overdue first.
  for (const r of arrearsRows) {
    const monthsBehind = r.rentPcm > 0 ? r.arrears / r.rentPcm : 0;
    const room =
      r.unit.unitType === "room" && r.unit.roomNumber ? ` · Room ${r.unit.roomNumber}` : "";
    actions.push({
      id: `arrears-${r.contractId}`,
      severity: monthsBehind >= 2 ? "critical" : "high",
      category: "arrears",
      title: `£${Math.round(r.arrears).toLocaleString()} in arrears`,
      subject: `${r.tenant.name} · ${r.property.name}${room}`,
      context: r.lastPaidAt
        ? `${monthsBehind.toFixed(1)} months behind`
        : "No payment recorded yet",
      href: "/rent-collection",
      action_label: "Chase",
      sort_value: r.arrears,
    });
  }

  // 2. Alerts we can act on today: deposit deadlines (legal), landlord
  //    contract expiries, cost spikes, below-target. Vacancy / move-out alerts
  //    are intentionally skipped — the sections below cover them with richer £.
  for (const a of alerts) {
    const m = a.metadata as Record<string, unknown>;
    const where = `${a.property_name ?? "—"}${a.unit_label ? ` · ${a.unit_label}` : ""}`;
    if (a.alert_type === "deposit_deadline") {
      const days = Number(m.days_until_deadline ?? 0);
      actions.push({
        id: `deposit-${a.id}`,
        severity: days <= 3 ? "critical" : "high",
        category: "deposit",
        title: "Deposit protection deadline",
        subject: where,
        context: `${days} day${days === 1 ? "" : "s"} left${m.deposit_scheme ? ` · ${m.deposit_scheme}` : ""}`,
        href: "/contracts",
        action_label: "Protect",
        sort_value: 1000 - days, // tighter deadline ranks higher
      });
    } else if (a.alert_type === "landlord_contract_expiry") {
      const days = Number(m.days_until_expiry ?? 0);
      actions.push({
        id: `contract-${a.id}`,
        severity: days <= 30 ? "high" : "medium",
        category: "contract",
        title: "Landlord contract expiring",
        subject: `${m.owner_landlord_name ?? where}`,
        context: `Expires in ${days} day${days === 1 ? "" : "s"}`,
        href: a.property_id ? `/properties/${a.property_id}` : "/properties",
        action_label: "Review",
        sort_value: 1000 - days,
      });
    } else if (a.alert_type === "cost_spike" || a.alert_type === "profitability_below_target") {
      actions.push({
        id: `cost-${a.id}`,
        severity: "medium",
        category: "cost",
        title: a.alert_type === "cost_spike" ? "Cost spike logged" : "Below profit target",
        subject: where,
        context:
          a.alert_type === "cost_spike"
            ? `${m.cost_label ?? m.cost_type ?? "Unexpected cost"}`
            : `${m.months_below ?? 0} month(s) under target`,
        href: a.property_id ? `/profitability/${a.property_id}` : "/profitability",
        action_label: "View P&L",
        sort_value: 0,
      });
    }
  }

  // 3. Critical maintenance — a single aggregate action linking to the queue.
  if (criticalJobs > 0) {
    actions.push({
      id: "maintenance-critical",
      severity: "critical",
      category: "maintenance",
      title: `${criticalJobs} critical maintenance ${criticalJobs === 1 ? "job" : "jobs"}`,
      subject: "Awaiting assignment",
      context: "High-priority repairs open",
      href: "/maintenance",
      action_label: "Review",
      sort_value: criticalJobs,
    });
  }

  // 4. Move-outs inside 21 days — arrange checkout & re-let.
  for (const mo of upcomingMoveOuts) {
    if (mo.days_remaining > 21) continue;
    actions.push({
      id: `moveout-${mo.unit_id}`,
      severity: mo.days_remaining <= 7 ? "high" : "medium",
      category: "move_out",
      title: `Move-out in ${mo.days_remaining} day${mo.days_remaining === 1 ? "" : "s"}`,
      subject: `${mo.tenant_name ?? "Tenant"} · ${mo.unit_label} · ${mo.property_name}`,
      context: `Vacates ${new Date(mo.vacate_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — arrange re-let`,
      href: "/contracts?filter=notice_given",
      action_label: "Arrange",
      sort_value: 100 - mo.days_remaining,
    });
  }

  // 5. Vacancy burn — units empty 14+ days, biggest loss first.
  for (const v of vacancyUnits) {
    if (v.days_vacant < 14) continue;
    actions.push({
      id: `vacancy-${v.unit_id}`,
      severity: v.days_vacant >= 30 ? "high" : "medium",
      category: "vacancy",
      title: `£${Math.round(v.total_loss).toLocaleString()} lost to vacancy`,
      subject: `${v.unit_label} · ${v.property_name}`,
      context: `${v.days_vacant} days vacant · £${v.daily_loss}/day`,
      href: `/properties?unit=${v.unit_id}`,
      action_label: "Re-let",
      sort_value: v.total_loss,
    });
  }

  return actions.sort((a, b) => {
    const sev = ACTION_SEVERITY_RANK[a.severity] - ACTION_SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    const cat = ACTION_CATEGORY_RANK[a.category] - ACTION_CATEGORY_RANK[b.category];
    if (cat !== 0) return cat;
    return b.sort_value - a.sort_value;
  });
}
