/**
 * Manager commission maths. Pure — no I/O — so it can be checked in isolation.
 *
 * The manager's cut is a percentage of the rental net (after card fee and VAT
 * where it applies) or of the bonus amount. It comes out of the company's
 * share and is not capped: if it is more than the company keeps, the company
 * is down on that deal (company_keeps goes negative).
 */
import { bonusAgentShare, computeRentalNet, roundMoney } from "@/features/earnings/lib/money";
import type {
  ManagerAgentSummary,
  ManagerLine,
  ManagerLineState,
  ManagerPlan,
  ManagerSourceType,
  ManagerTotals,
} from "../domain/types";

export type RentalSource = {
  id: string;
  code: string | null;
  /** rental_codes has no client_name column; the name lives in the snapshot. */
  client_snapshot: { full_name?: string | null } | null;
  date: string;
  consultation_fee_amount: number;
  payment_method: string;
  vat_applies: boolean | null;
  status: string;
  assisted_by_agent_id: string;
};

export type BonusSource = {
  id: string;
  client_name: string | null;
  amount_owed: number;
  payout_mode: string | null;
  bonus_date: string | null;
  created_at: string;
  status: string;
  agent_id: string;
};

export type ManagerPayment = {
  manager_id: string;
  source_type: ManagerSourceType;
  source_id: string;
  amount_gbp: number;
  paid_at: string;
};

const RENTAL_EARNED = new Set(["approved", "paid"]);
const RENTAL_PENDING = new Set(["pending", "need_more_info"]);
const BONUS_EARNED = new Set(["approved", "sent", "paid"]);
const BONUS_PENDING = new Set(["pending"]);

/** YYYY-MM-DD from a date or timestamp string. */
export function dayOf(value: string): string {
  return value.slice(0, 10);
}

export function paymentKey(managerId: string, sourceType: ManagerSourceType, sourceId: string) {
  return `${managerId}:${sourceType}:${sourceId}`;
}

/** The plan version covering `agentId` on `day`. With one manager per agent,
 *  at most one version ever matches. */
export function planFor(plans: ManagerPlan[], agentId: string, day: string): ManagerPlan | null {
  return (
    plans.find(
      (p) =>
        p.agent_ids.includes(agentId) &&
        p.effective_from <= day &&
        (p.effective_to === null || day <= p.effective_to)
    ) ?? null
  );
}

/** The rate for one agent: their own if set, otherwise the manager's default. */
export function percentFor(plan: ManagerPlan, agentId: string): number {
  return plan.agent_rates[agentId] ?? plan.commission_percent;
}

function coversRentals(plan: ManagerPlan) {
  return plan.applies_to === "rentals" || plan.applies_to === "both";
}

function coversBonuses(plan: ManagerPlan) {
  return plan.applies_to === "bonuses" || plan.applies_to === "both";
}

function stateFor(
  status: string,
  earned: Set<string>,
  pending: Set<string>,
  isPaid: boolean
): ManagerLineState | null {
  if (earned.has(status)) return "earned";
  if (pending.has(status)) return isPaid ? "earned" : "pending";
  // Refunded / declined: only kept when money already went out.
  return isPaid ? "void" : null;
}

export function managerCut(base: number, percent: number): number {
  return roundMoney(base * (percent / 100));
}

export function buildManagerLines({
  plans,
  rentals,
  bonuses,
  payments,
  agentNames,
  agentCommission,
}: {
  plans: ManagerPlan[];
  rentals: RentalSource[];
  bonuses: BonusSource[];
  payments: ManagerPayment[];
  agentNames: Map<string, string>;
  /** Assisted agents' commission % — pass null to leave company_keeps out
   *  (non-admin viewers). */
  agentCommission: Map<string, number> | null;
}): ManagerLine[] {
  const paidByKey = new Map(
    payments.map((p) => [paymentKey(p.manager_id, p.source_type, p.source_id), p])
  );
  const lines: ManagerLine[] = [];

  for (const r of rentals) {
    const day = dayOf(r.date);
    const plan = planFor(plans, r.assisted_by_agent_id, day);
    if (!plan || !coversRentals(plan)) continue;

    const paid = paidByKey.get(paymentKey(plan.manager_id, "rental", r.id)) ?? null;
    const state = stateFor(r.status, RENTAL_EARNED, RENTAL_PENDING, Boolean(paid));
    if (!state) continue;

    const base = computeRentalNet(r.consultation_fee_amount, r.payment_method, r.vat_applies);
    const percent = percentFor(plan, r.assisted_by_agent_id);
    const amount = managerCut(base, percent);
    const agentPct = agentCommission?.get(r.assisted_by_agent_id);

    lines.push({
      key: paymentKey(plan.manager_id, "rental", r.id),
      manager_id: plan.manager_id,
      plan_id: plan.id,
      source_type: "rental",
      source_id: r.id,
      agent_id: r.assisted_by_agent_id,
      agent_name: agentNames.get(r.assisted_by_agent_id) ?? "Agent",
      date: day,
      code: r.code ?? "",
      client_name: r.client_snapshot?.full_name ?? "",
      base,
      percent,
      amount,
      source_status: r.status,
      state,
      paid: paid ? { amount: Number(paid.amount_gbp), paid_at: paid.paid_at } : null,
      // The marketing fee comes out of the assisted agent's gross, so the
      // company's share is net − assisted gross, whoever did the marketing.
      company_keeps:
        agentCommission === null
          ? null
          : roundMoney(base - managerCut(base, agentPct ?? 0) - amount),
    });
  }

  for (const b of bonuses) {
    const day = dayOf(b.bonus_date ?? b.created_at);
    const plan = planFor(plans, b.agent_id, day);
    if (!plan || !coversBonuses(plan)) continue;

    const paid = paidByKey.get(paymentKey(plan.manager_id, "bonus", b.id)) ?? null;
    const state = stateFor(b.status, BONUS_EARNED, BONUS_PENDING, Boolean(paid));
    if (!state) continue;

    const base = roundMoney(Number(b.amount_owed ?? 0));
    const percent = percentFor(plan, b.agent_id);
    const amount = managerCut(base, percent);
    const agentPct = agentCommission?.get(b.agent_id);

    lines.push({
      key: paymentKey(plan.manager_id, "bonus", b.id),
      manager_id: plan.manager_id,
      plan_id: plan.id,
      source_type: "bonus",
      source_id: b.id,
      agent_id: b.agent_id,
      agent_name: agentNames.get(b.agent_id) ?? "Agent",
      date: day,
      code: "",
      client_name: b.client_name ?? "",
      base,
      percent,
      amount,
      source_status: b.status,
      state,
      paid: paid ? { amount: Number(paid.amount_gbp), paid_at: paid.paid_at } : null,
      company_keeps:
        agentCommission === null
          ? null
          : roundMoney(base - bonusAgentShare(base, b.payout_mode, agentPct ?? 0) - amount),
    });
  }

  return lines.sort((a, b) => b.date.localeCompare(a.date));
}

/** What a line contributes to each total. Paid lines count at what was
 *  actually paid; unpaid payable lines at today's figure. */
export function lineTotals(line: ManagerLine): ManagerTotals {
  if (line.paid) {
    return { earned: line.paid.amount, pending: 0, paid: line.paid.amount, unpaid: 0 };
  }
  if (line.state === "earned") {
    return { earned: line.amount, pending: 0, paid: 0, unpaid: line.amount };
  }
  if (line.state === "pending") {
    return { earned: 0, pending: line.amount, paid: 0, unpaid: 0 };
  }
  return { earned: 0, pending: 0, paid: 0, unpaid: 0 };
}

export function emptyTotals(): ManagerTotals {
  return { earned: 0, pending: 0, paid: 0, unpaid: 0 };
}

export function addTotals(into: ManagerTotals, add: ManagerTotals) {
  into.earned = roundMoney(into.earned + add.earned);
  into.pending = roundMoney(into.pending + add.pending);
  into.paid = roundMoney(into.paid + add.paid);
  into.unpaid = roundMoney(into.unpaid + add.unpaid);
}

export function sumLines(lines: ManagerLine[]): ManagerTotals {
  const totals = emptyTotals();
  for (const line of lines) addTotals(totals, lineTotals(line));
  return totals;
}

/** Per-agent breakdown: how much the manager made on each agent. */
export function groupByAgent(lines: ManagerLine[]): ManagerAgentSummary[] {
  const byAgent = new Map<string, ManagerAgentSummary>();

  for (const line of lines) {
    let row = byAgent.get(line.agent_id);
    if (!row) {
      row = {
        agent_id: line.agent_id,
        agent_name: line.agent_name,
        rentals: 0,
        rental_base: 0,
        bonuses: 0,
        bonus_base: 0,
        lines: [],
        ...emptyTotals(),
      };
      byAgent.set(line.agent_id, row);
    }
    row.lines.push(line);
    if (line.source_type === "rental") {
      row.rentals += 1;
      row.rental_base = roundMoney(row.rental_base + line.base);
    } else {
      row.bonuses += 1;
      row.bonus_base = roundMoney(row.bonus_base + line.base);
    }
    addTotals(row, lineTotals(line));
  }

  return [...byAgent.values()].sort(
    (a, b) => b.earned + b.pending - (a.earned + a.pending) || a.agent_name.localeCompare(b.agent_name)
  );
}
