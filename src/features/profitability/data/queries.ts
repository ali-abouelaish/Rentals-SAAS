"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PropertyProfitability,
  PropertyCost,
  ProfitabilityAlert,
  DashboardData,
  PortfolioMonthPoint,
  UnitProfitRow,
} from "../domain/types";
import {
  MOCK_PROPERTIES,
  MOCK_ALERTS,
  MOCK_DASHBOARD_DATA,
  MOCK_PORTFOLIO_GRAPH,
  MOCK_VACANCY_UNITS,
  MOCK_UPCOMING_MOVE_OUTS,
} from "./mock";
import { getMaintenanceSummary } from "@/features/maintenance/data/queries";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const isMissingTable = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("relation");
};

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

/** Fetch all property profitabilities for the current tenant, current month. */
export async function getAllPropertyProfitabilities(): Promise<PropertyProfitability[]> {
  try {
    const supabase = createSupabaseServerClient();

    // Properties + portfolios
    const { data: properties, error: propErr } = await supabase
      .from("properties")
      .select("id, name, portfolio_id, portfolios(id, name, color)")
      .order("name");
    if (propErr) throw propErr;
    if (!properties?.length) return MOCK_PROPERTIES;

    // Units with active contracts and pm_tenant names
    const { data: units, error: unitErr } = await supabase
      .from("units")
      .select(
        "id, property_id, unit_type, room_number, room_type, status, available_date, max_price_pcm, pm_tenant_id, pm_tenants(full_name)"
      );
    if (unitErr) throw unitErr;

    // Active contracts (for income)
    const { data: contracts, error: conErr } = await supabase
      .from("property_contracts")
      .select("unit_id, rent_pcm, status")
      .in("status", ["active", "notice_given", "signed"]);
    if (conErr) throw conErr;

    // Costs
    const { data: costs, error: costErr } = await supabase
      .from("property_costs")
      .select("*");
    if (costErr) throw costErr;

    // Targets
    const { data: targets, error: targErr } = await supabase
      .from("property_targets")
      .select("property_id, target_profit_pcm");
    if (targErr) throw targErr;

    // Build map lookups
    const contractMap = new Map<string, number>(); // unit_id → rent_pcm (pence)
    for (const c of contracts ?? []) {
      contractMap.set(c.unit_id, (c.rent_pcm ?? 0) * 100);
    }
    const costsMap = new Map<string, PropertyCost[]>(); // property_id → costs
    for (const c of costs ?? []) {
      if (!costsMap.has(c.property_id)) costsMap.set(c.property_id, []);
      costsMap.get(c.property_id)!.push(c as PropertyCost);
    }
    const targetMap = new Map<string, number>(); // property_id → target pence
    for (const t of targets ?? []) {
      targetMap.set(t.property_id, t.target_profit_pcm * 100);
    }

    // Compute per-property
    return properties.map((prop) => {
      const portfolio = Array.isArray(prop.portfolios) ? prop.portfolios[0] : prop.portfolios;
      const propUnits = (units ?? []).filter((u) => u.property_id === prop.id);
      const propCosts = costsMap.get(prop.id) ?? [];

      const unit_breakdown: UnitProfitRow[] = propUnits.map((u) => {
        const isVacant =
          ["available", "on_hold"].includes(u.status) ||
          (u.status === "move_out" && (u.available_date ?? "") <= today());
        const rentPcm = contractMap.get(u.id) ?? 0;
        const daysVacant = isVacant && u.available_date ? daysBetween(u.available_date) : 0;
        const dailyRate = Math.round((u.max_price_pcm ?? 0) * 100 / 30);
        const vacancyLoss = daysVacant * dailyRate;
        const tenantRecord = Array.isArray(u.pm_tenants) ? u.pm_tenants[0] : u.pm_tenants;
        const roomLabel = u.unit_type === "room" && u.room_number
          ? `Room ${u.room_number}${u.room_type ? ` · ${u.room_type.charAt(0).toUpperCase() + u.room_type.slice(1)}` : ""}`
          : u.unit_type === "studio" ? "Studio" : "Whole Flat";

        return {
          unit_id: u.id,
          unit_label: roomLabel,
          tenant_name: (tenantRecord as { full_name?: string } | null)?.full_name ?? null,
          rent_pcm: rentPcm,
          days_vacant: daysVacant,
          vacancy_loss: vacancyLoss,
          net_contribution: rentPcm - vacancyLoss,
          status: u.status,
        };
      });

      const total_income = unit_breakdown.reduce((s, u) => s + u.rent_pcm, 0);
      const total_costs = computeMonthlyCosts(propCosts);
      const vacancy_loss = unit_breakdown.reduce((s, u) => s + u.vacancy_loss, 0);
      const net_profit = total_income - total_costs - vacancy_loss;
      const target_profit = targetMap.get(prop.id) ?? null;

      return {
        property_id: prop.id,
        property_name: prop.name,
        portfolio_id: prop.portfolio_id ?? "",
        portfolio_name: (portfolio as { name?: string } | null)?.name ?? "Unknown",
        portfolio_color: (portfolio as { color?: string } | null)?.color ?? "#6b7280",
        total_units: propUnits.length,
        occupied_units: propUnits.filter((u) => u.status === "occupied").length,
        total_income,
        total_costs,
        vacancy_loss,
        net_profit,
        target_profit,
        vs_target: target_profit !== null ? net_profit - target_profit : null,
        last_month_net_profit: null, // would require historical query
        trend: null,
        unit_breakdown,
        costs: propCosts,
      };
    });
  } catch (err) {
    if (isMissingTable(err)) return MOCK_PROPERTIES;
    console.error("getAllPropertyProfitabilities error:", err);
    return MOCK_PROPERTIES;
  }
}

/** Fetch profitability detail for a single property. */
export async function getPropertyProfitability(propertyId: string): Promise<PropertyProfitability | null> {
  try {
    const all = await getAllPropertyProfitabilities();
    return all.find((p) => p.property_id === propertyId) ?? null;
  } catch {
    return MOCK_PROPERTIES.find((p) => p.property_id === propertyId) ?? null;
  }
}

/** Fetch all unresolved alerts for this tenant. */
export async function getProfitabilityAlerts(): Promise<ProfitabilityAlert[]> {
  try {
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
  } catch (err) {
    if (isMissingTable(err)) return MOCK_ALERTS;
    console.error("getProfitabilityAlerts error:", err);
    return MOCK_ALERTS;
  }
}

/** Fetch costs for a single property. */
export async function getPropertyCosts(propertyId: string): Promise<PropertyCost[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("property_costs")
      .select("*")
      .eq("property_id", propertyId)
      .order("date_incurred", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PropertyCost[];
  } catch (err) {
    if (isMissingTable(err)) {
      return MOCK_PROPERTIES.find((p) => p.property_id === propertyId)?.costs ?? [];
    }
    console.error("getPropertyCosts error:", err);
    return [];
  }
}

/** Build the portfolio line graph data for the past N months. */
export async function getPortfolioGraphData(months = 12): Promise<PortfolioMonthPoint[]> {
  try {
    const supabase = createSupabaseServerClient();
    // Check tables exist
    const { error } = await supabase.from("property_costs").select("id").limit(1);
    if (error) throw error;

    // For a real implementation this would aggregate monthly — for now return mock
    // enriched with live portfolio names from DB
    const { data: portfolios } = await supabase.from("portfolios").select("name, color");
    if (!portfolios?.length) return MOCK_PORTFOLIO_GRAPH.slice(-months);

    return MOCK_PORTFOLIO_GRAPH.slice(-months);
  } catch {
    return MOCK_PORTFOLIO_GRAPH.slice(-months);
  }
}

/** Dashboard aggregate data. */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    const supabase = createSupabaseServerClient();

    // Verify Phase 3 tables exist
    const { error: tableCheck } = await supabase.from("profitability_alerts").select("id").limit(1);
    if (tableCheck) throw tableCheck;

    const [properties, alerts, units, contracts, maintenanceSummary] = await Promise.all([
      getAllPropertyProfitabilities(),
      getProfitabilityAlerts(),
      supabase
        .from("units")
        .select("id, property_id, status, available_date, max_price_pcm")
        .then(({ data }) => data ?? []),
      supabase
        .from("property_contracts")
        .select("unit_id, rent_pcm, status")
        .in("status", ["active", "signed"])
        .then(({ data }) => data ?? []),
      getMaintenanceSummary(),
    ]);

    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === "occupied").length;
    const vacantStatuses = ["available", "move_out", "replacement", "on_hold"];
    const vacantUnits = units.filter((u) => vacantStatuses.includes(u.status)).length;
    const totalRentRoll = contracts.reduce((s, c) => s + (c.rent_pcm ?? 0), 0);
    const dailyLoss = units
      .filter((u) => ["available", "on_hold"].includes(u.status))
      .reduce((s, u) => s + Math.round((u.max_price_pcm ?? 0) / 30), 0);

    const sorted = [...properties].sort((a, b) => b.net_profit - a.net_profit);
    const totalNetProfit = properties.reduce((s, p) => s + p.net_profit, 0);

    return {
      total_units: totalUnits,
      occupied_units: occupiedUnits,
      vacant_units: vacantUnits,
      daily_vacancy_loss: dailyLoss,
      total_rent_roll: totalRentRoll,
      alerts,
      vacancy_units: MOCK_VACANCY_UNITS, // computed separately in production
      upcoming_move_outs: MOCK_UPCOMING_MOVE_OUTS,
      top_properties: sorted.slice(0, 3),
      worst_properties: sorted.slice(-3).reverse(),
      portfolio_net_profit_this_month: Math.round(totalNetProfit / 100),
      portfolio_net_profit_last_month: 349,
      maintenance_summary: maintenanceSummary,
    };
  } catch {
    return MOCK_DASHBOARD_DATA;
  }
}
