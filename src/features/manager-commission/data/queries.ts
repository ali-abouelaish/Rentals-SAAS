import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import {
  addTotals,
  buildManagerLines,
  emptyTotals,
  groupByAgent,
  sumLines,
  type BonusSource,
  type ManagerPayment,
  type RentalSource,
} from "../lib/compute";
import type {
  ManagerAppliesTo,
  ManagerCommissionResult,
  ManagerLine,
  ManagerOverviewRow,
  ManagerPlan,
  ManagerPlanWithAgents,
  PoolCandidate,
} from "../domain/types";

type Supabase = ReturnType<typeof createSupabaseServerClient>;
type Period = { from: string; to: string };

const EMPTY_RESULT: ManagerCommissionResult = {
  hasPlans: false,
  byAgent: [],
  totals: emptyTotals(),
};

/** The manager tables are applied by hand; until they exist every query here
 *  degrades to "no managers" instead of taking the earnings pages down. */
function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    // Only a missing *table*: a missing column is a real bug and must surface.
    /relation .* does not exist|could not find the table/i.test(error.message ?? "")
  );
}

function endOfDay(day: string) {
  return `${day}T23:59:59.999Z`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** PostgREST caps responses at 1000 rows and URLs at ~8KB, so long id lists
 *  are queried in slices. */
async function inChunks<T>(ids: string[], run: (slice: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    out.push(...(await run(ids.slice(i, i + 100))));
  }
  return out;
}

type PlanRow = {
  id: string;
  manager_id: string;
  commission_percent: number | string;
  applies_to: ManagerAppliesTo;
  effective_from: string;
  effective_to: string | null;
  manager_commission_pool: { agent_id: string; commission_percent?: number | string | null }[] | null;
};

const PLAN_SELECT =
  "id, manager_id, commission_percent, applies_to, effective_from, effective_to, manager_commission_pool(agent_id, commission_percent)";

function toPlan(row: PlanRow): ManagerPlan {
  const pool = row.manager_commission_pool ?? [];
  const agent_rates: Record<string, number> = {};
  for (const p of pool) {
    if (p.commission_percent !== null && p.commission_percent !== undefined) {
      agent_rates[p.agent_id] = Number(p.commission_percent);
    }
  }
  return {
    id: row.id,
    manager_id: row.manager_id,
    commission_percent: Number(row.commission_percent),
    applies_to: row.applies_to,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    agent_ids: pool.map((p) => p.agent_id),
    agent_rates,
  };
}

/** Plans overlapping [from, to], optionally for one manager. */
async function loadPlans(
  supabase: Supabase,
  tenantId: string,
  period: Period,
  managerId?: string
): Promise<ManagerPlan[] | null> {
  let query = supabase
    .from("manager_commission_plans")
    .select(PLAN_SELECT)
    .eq("tenant_id", tenantId)
    .lte("effective_from", period.to)
    .or(`effective_to.is.null,effective_to.gte.${period.from}`);
  if (managerId) query = query.eq("manager_id", managerId);

  const { data, error } = await query;
  if (isMissingTable(error)) return null;
  if (error) throw new Error(error.message);
  return ((data ?? []) as PlanRow[]).map(toPlan);
}

async function loadNames(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await inChunks(ids, async (slice) => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", slice);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  return new Map(rows.map((r) => [r.id as string, (r.display_name as string | null) ?? "Agent"]));
}

/** Every manager line for the given plans' pools over the period. */
async function loadLines(
  supabase: Supabase,
  tenantId: string,
  plans: ManagerPlan[],
  period: Period,
  withCompanyKeeps: boolean
): Promise<ManagerLine[]> {
  const agentIds = [...new Set(plans.flatMap((p) => p.agent_ids))];
  if (agentIds.length === 0) return [];

  const wantRentals = plans.some((p) => p.applies_to !== "bonuses");
  const wantBonuses = plans.some((p) => p.applies_to !== "rentals");

  const [rentals, bonuses, agentNames, agentCommission] = await Promise.all([
    wantRentals
      ? inChunks<RentalSource>(agentIds, async (slice) => {
          const { data, error } = await supabase
            .from("rental_codes")
            .select(
              "id, code, client_snapshot, date, consultation_fee_amount, payment_method, vat_applies, status, assisted_by_agent_id"
            )
            .eq("tenant_id", tenantId)
            .in("assisted_by_agent_id", slice)
            .gte("date", period.from)
            .lte("date", endOfDay(period.to));
          if (error) throw new Error(error.message);
          return (data ?? []) as RentalSource[];
        })
      : Promise.resolve([] as RentalSource[]),
    wantBonuses
      ? inChunks<BonusSource>(agentIds, async (slice) => {
          // Older bonuses have no bonus_date; fall back to when they were logged.
          const { data, error } = await supabase
            .from("bonuses")
            .select("id, client_name, amount_owed, payout_mode, bonus_date, created_at, status, agent_id")
            .eq("tenant_id", tenantId)
            .in("agent_id", slice)
            .or(
              `and(bonus_date.gte.${period.from},bonus_date.lte.${period.to}),` +
                `and(bonus_date.is.null,created_at.gte.${period.from},created_at.lte.${endOfDay(period.to)})`
            );
          if (error) throw new Error(error.message);
          return (data ?? []) as BonusSource[];
        })
      : Promise.resolve([] as BonusSource[]),
    loadNames(supabase, agentIds),
    withCompanyKeeps
      ? inChunks(agentIds, async (slice) => {
          const { data, error } = await supabase
            .from("agent_profiles")
            .select("user_id, commission_percent")
            .in("user_id", slice);
          if (error) throw new Error(error.message);
          return data ?? [];
        }).then(
          (rows) =>
            new Map(rows.map((r) => [r.user_id as string, Number(r.commission_percent ?? 0)]))
        )
      : Promise.resolve(null),
  ]);

  const sourceIds = [...rentals.map((r) => r.id), ...bonuses.map((b) => b.id)];
  const managerIds = [...new Set(plans.map((p) => p.manager_id))];
  const payments = await inChunks<ManagerPayment>(sourceIds, async (slice) => {
    const { data, error } = await supabase
      .from("manager_commission_payments")
      .select("manager_id, source_type, source_id, amount_gbp, paid_at")
      .eq("tenant_id", tenantId)
      .in("manager_id", managerIds)
      .in("source_id", slice);
    if (error) throw new Error(error.message);
    return (data ?? []) as ManagerPayment[];
  });

  return buildManagerLines({
    plans,
    rentals,
    bonuses,
    payments,
    agentNames,
    agentCommission,
  });
}

/**
 * One manager's commission over a period, broken down by agent. Visible to
 * admins and to the manager themself.
 */
export async function getManagerCommission(
  managerId: string,
  period: Period
): Promise<ManagerCommissionResult> {
  const profile = await requireUserProfile();
  const isAdmin = isAdminRole(profile.role);
  if (!isAdmin && profile.id !== managerId) return EMPTY_RESULT;
  if (!(await hasFeature("manager_commission"))) return EMPTY_RESULT;

  const supabase = createSupabaseServerClient();
  const plans = await loadPlans(supabase, profile.tenant_id, period, managerId);
  if (!plans || plans.length === 0) return EMPTY_RESULT;

  const lines = await loadLines(supabase, profile.tenant_id, plans, period, isAdmin);
  return { hasPlans: true, byAgent: groupByAgent(lines), totals: sumLines(lines) };
}

/** Every manager's totals for the period — admin overview on /earnings. */
export async function getManagersOverview(period: Period): Promise<ManagerOverviewRow[]> {
  const profile = await requireUserProfile();
  if (!isAdminRole(profile.role)) return [];
  if (!(await hasFeature("manager_commission"))) return [];

  const supabase = createSupabaseServerClient();
  const plans = await loadPlans(supabase, profile.tenant_id, period);
  if (!plans || plans.length === 0) return [];

  const lines = await loadLines(supabase, profile.tenant_id, plans, period, false);
  const names = await loadNames(supabase, [...new Set(plans.map((p) => p.manager_id))]);

  // A manager's pool can change within the period; count every agent they
  // managed at any point in it.
  const agentsPerManager = new Map<string, Set<string>>();
  for (const plan of plans) {
    const set = agentsPerManager.get(plan.manager_id) ?? new Set<string>();
    plan.agent_ids.forEach((id) => set.add(id));
    agentsPerManager.set(plan.manager_id, set);
  }
  const rows = new Map<string, ManagerOverviewRow>();
  for (const [managerId, agents] of agentsPerManager) {
    rows.set(managerId, {
      manager_id: managerId,
      manager_name: names.get(managerId) ?? "Manager",
      agent_count: agents.size,
      ...emptyTotals(),
    });
  }
  for (const line of lines) {
    const row = rows.get(line.manager_id);
    if (row) addTotals(row, sumLines([line]));
  }

  return [...rows.values()].sort((a, b) => b.earned - a.earned || a.manager_name.localeCompare(b.manager_name));
}

/**
 * Payable manager lines for the Earnings → Payments tab, mirroring the
 * rentals/bonuses rule there: unpaid lines always show; the date range only
 * limits paid ones. Admins see every manager; a manager sees their own.
 */
export async function getManagerPaymentLines(
  period: Period,
  statusFilter: "all" | "paid" | "unpaid"
): Promise<{ line: ManagerLine; manager_name: string }[]> {
  const profile = await requireUserProfile();
  const isAdmin = isAdminRole(profile.role);
  if (!(await hasFeature("manager_commission"))) return [];

  const supabase = createSupabaseServerClient();

  // Unpaid lines can be older than the range, so look back to the first plan.
  let lookup = period;
  if (statusFilter !== "paid") {
    let first = supabase
      .from("manager_commission_plans")
      .select("effective_from")
      .eq("tenant_id", profile.tenant_id)
      .order("effective_from", { ascending: true })
      .limit(1);
    if (!isAdmin) first = first.eq("manager_id", profile.id);
    const { data, error } = await first;
    if (isMissingTable(error)) return [];
    if (error) throw new Error(error.message);
    const earliest = data?.[0]?.effective_from as string | undefined;
    if (!earliest) return [];
    lookup = {
      from: earliest < period.from ? earliest : period.from,
      to: todayIso() > period.to ? todayIso() : period.to,
    };
  }

  const plans = await loadPlans(
    supabase,
    profile.tenant_id,
    lookup,
    isAdmin ? undefined : profile.id
  );
  if (!plans || plans.length === 0) return [];

  const lines = await loadLines(supabase, profile.tenant_id, plans, lookup, false);
  const inRange = (day: string) => day >= period.from && day <= period.to;
  const payable = lines.filter((line) => {
    if (line.paid) return statusFilter !== "unpaid" && inRange(line.date);
    if (line.state !== "earned") return false;
    return statusFilter !== "paid";
  });

  const names = await loadNames(supabase, [...new Set(payable.map((l) => l.manager_id))]);
  return payable.map((line) => ({ line, manager_name: names.get(line.manager_id) ?? "Manager" }));
}

/** Every version of a manager's terms, newest first. Admin or the manager. */
export async function getManagerPlanHistory(managerId: string): Promise<ManagerPlanWithAgents[]> {
  const profile = await requireUserProfile();
  if (!isAdminRole(profile.role) && profile.id !== managerId) return [];
  if (!(await hasFeature("manager_commission"))) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("manager_commission_plans")
    .select(PLAN_SELECT)
    .eq("tenant_id", profile.tenant_id)
    .eq("manager_id", managerId)
    .order("effective_from", { ascending: false });
  if (isMissingTable(error)) return [];
  if (error) throw new Error(error.message);

  const plans = ((data ?? []) as PlanRow[]).map(toPlan);
  const names = await loadNames(supabase, [...new Set(plans.flatMap((p) => p.agent_ids))]);
  return plans.map((p) => ({
    ...p,
    agents: p.agent_ids
      .map((id) => ({ id, name: names.get(id) ?? "Agent", commission_percent: p.agent_rates[id] ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/**
 * Agents who can go in a manager's pool: everyone in the tenant except the
 * manager. Each is flagged with the manager whose pool they're in today, if any.
 */
export async function getPoolCandidates(managerId: string): Promise<PoolCandidate[]> {
  const profile = await requireUserProfile();
  if (!isAdminRole(profile.role)) return [];

  const supabase = createSupabaseServerClient();
  // user_profiles!inner keeps stray agent_profiles rows from other tenants out.
  const { data: agents, error } = await supabase
    .from("agent_profiles")
    .select("user_id, is_disabled, user_profiles!inner(display_name, tenant_id)")
    .eq("user_profiles.tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  const today = todayIso();
  const { data: current, error: planError } = await supabase
    .from("manager_commission_plans")
    .select("manager_id, effective_from, effective_to, manager_commission_pool(agent_id)")
    .eq("tenant_id", profile.tenant_id)
    .neq("manager_id", managerId)
    .or(`effective_to.is.null,effective_to.gte.${today}`);
  if (planError && !isMissingTable(planError)) throw new Error(planError.message);

  const currentManagerOf = new Map<string, string>();
  for (const plan of (current ?? []) as PlanRow[]) {
    // The version in force today (a future-dated one doesn't count yet).
    if (plan.effective_from > today) continue;
    for (const p of plan.manager_commission_pool ?? []) currentManagerOf.set(p.agent_id, plan.manager_id);
  }
  const managerNames = await loadNames(supabase, [...new Set(currentManagerOf.values())]);

  return (agents ?? [])
    .filter((a) => a.user_id !== managerId)
    .map((a) => {
      const up = a.user_profiles as unknown as { display_name: string | null } | null;
      const managerOf = currentManagerOf.get(a.user_id as string);
      return {
        id: a.user_id as string,
        name: up?.display_name ?? "Agent",
        is_disabled: Boolean(a.is_disabled),
        current_manager_name: managerOf ? managerNames.get(managerOf) ?? "another manager" : null,
      };
    })
    .sort((a, b) => Number(a.is_disabled) - Number(b.is_disabled) || a.name.localeCompare(b.name));
}

/** Users who are managers today — for the badge on the agents list. */
export async function getCurrentManagerIds(): Promise<Set<string>> {
  const profile = await requireUserProfile();
  if (!(await hasFeature("manager_commission"))) return new Set();

  const supabase = createSupabaseServerClient();
  const today = todayIso();
  const { data, error } = await supabase
    .from("manager_commission_plans")
    .select("manager_id")
    .eq("tenant_id", profile.tenant_id)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`);
  if (isMissingTable(error)) return new Set();
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.manager_id as string));
}
