export type ManagerAppliesTo = "rentals" | "bonuses" | "both";

export const APPLIES_TO_LABELS: Record<ManagerAppliesTo, string> = {
  rentals: "Rentals only",
  bonuses: "Bonuses only",
  both: "Rentals and bonuses",
};

/** One dated version of a manager's terms. */
export type ManagerPlan = {
  id: string;
  manager_id: string;
  commission_percent: number;
  applies_to: ManagerAppliesTo;
  /** YYYY-MM-DD, inclusive. */
  effective_from: string;
  /** YYYY-MM-DD, inclusive. Null = the current version. */
  effective_to: string | null;
  agent_ids: string[];
  /** Agents with their own rate instead of commission_percent. */
  agent_rates: Record<string, number>;
};

export type ManagerPlanWithAgents = ManagerPlan & {
  /** commission_percent is the agent's own rate, or null for the manager's default. */
  agents: { id: string; name: string; commission_percent: number | null }[];
};

export type ManagerSourceType = "rental" | "bonus";

/**
 * earned  — the deal is approved/paid, so the manager's cut is payable.
 * pending — the deal is still awaiting approval; shown but not payable yet.
 * void    — the deal was refunded/declined after the manager line was paid.
 *           Kept so the money that went out stays visible.
 */
export type ManagerLineState = "earned" | "pending" | "void";

/** The manager's cut on a single rental or bonus. */
export type ManagerLine = {
  key: string;
  manager_id: string;
  plan_id: string | null;
  source_type: ManagerSourceType;
  source_id: string;
  agent_id: string;
  agent_name: string;
  /** YYYY-MM-DD — the deal date the plan was matched on. */
  date: string;
  /** Rental code, or empty for bonuses. */
  code: string;
  client_name: string;
  /** Rental net (after card fee and VAT where it applies) or bonus amount. */
  base: number;
  percent: number;
  /** The manager's cut worked out from today's figures. */
  amount: number;
  source_status: string;
  state: ManagerLineState;
  paid: { amount: number; paid_at: string } | null;
  /** What the company is left with after the agent and the manager. Admins only. */
  company_keeps: number | null;
};

export type ManagerTotals = {
  /** Paid lines at their paid amount + payable unpaid lines. */
  earned: number;
  /** Deals still awaiting approval. */
  pending: number;
  paid: number;
  unpaid: number;
};

export type ManagerAgentSummary = ManagerTotals & {
  agent_id: string;
  agent_name: string;
  rentals: number;
  rental_base: number;
  bonuses: number;
  bonus_base: number;
  lines: ManagerLine[];
};

export type ManagerCommissionResult = {
  /** False when the user had no manager terms covering the period. */
  hasPlans: boolean;
  byAgent: ManagerAgentSummary[];
  totals: ManagerTotals;
};

export type ManagerOverviewRow = ManagerTotals & {
  manager_id: string;
  manager_name: string;
  agent_count: number;
};

export type PoolCandidate = {
  id: string;
  name: string;
  is_disabled: boolean;
  /** Set when the agent is currently in another manager's pool. */
  current_manager_name: string | null;
};
