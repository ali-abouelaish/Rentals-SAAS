"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { computeRentalNet, roundMoney } from "@/features/earnings/lib/money";
import {
  endManagerPlanSchema,
  managerIdSchema,
  managerLinePaidSchema,
  managerPlanSchema,
  type EndManagerPlanValues,
  type ManagerPlanValues,
} from "../domain/schemas";
import { dayOf, managerCut, percentFor, planFor } from "../lib/compute";
import type { ManagerAppliesTo, ManagerPlan } from "../domain/types";

type Result = { ok: true } | { ok: false; error: string };

const NOT_ENABLED = "Manager commission isn't enabled for this agency.";

function revalidateManagerViews(managerId?: string) {
  revalidatePath("/earnings", "layout");
  revalidatePath("/me");
  revalidatePath("/agents");
  if (managerId) revalidatePath(`/agents/${managerId}`);
}

/** Postgres raises our friendly messages verbatim; strip the driver noise. */
function rpcError(message: string | undefined): string {
  return (message ?? "Something went wrong. Please try again.").replace(/^.*?ERROR:\s*/, "");
}

/** Create or change a manager's terms from a given date. */
export async function saveManagerPlan(managerId: string, values: ManagerPlanValues): Promise<Result> {
  await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("manager_commission"))) return { ok: false, error: NOT_ENABLED };

  const id = managerIdSchema.safeParse(managerId);
  if (!id.success) return { ok: false, error: "Invalid manager." };
  const parsed = managerPlanSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  // Own rates only for agents actually in the pool; blank = manager's default.
  const agentRates: Record<string, number> = {};
  for (const agentId of parsed.data.agent_ids) {
    const raw = parsed.data.agent_percents[agentId]?.trim();
    if (raw) agentRates[agentId] = Number(raw);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("save_manager_commission_plan", {
    p_manager_id: id.data,
    p_percent: parsed.data.commission_percent,
    p_applies_to: parsed.data.applies_to,
    p_agent_ids: parsed.data.agent_ids,
    p_effective_from: parsed.data.effective_from,
    p_agent_percents: agentRates,
  });
  if (error) return { ok: false, error: rpcError(error.message) };

  revalidateManagerViews(id.data);
  return { ok: true };
}

/** Stop a manager earning after the given day. */
export async function endManagerPlan(managerId: string, values: EndManagerPlanValues): Promise<Result> {
  await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("manager_commission"))) return { ok: false, error: NOT_ENABLED };

  const id = managerIdSchema.safeParse(managerId);
  if (!id.success) return { ok: false, error: "Invalid manager." };
  const parsed = endManagerPlanSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("end_manager_commission_plan", {
    p_manager_id: id.data,
    p_end_date: parsed.data.end_date,
  });
  if (error) return { ok: false, error: rpcError(error.message) };

  revalidateManagerViews(id.data);
  return { ok: true };
}

/**
 * Mark one manager line paid (recording what was paid) or unpaid. The amount
 * is recomputed here from the deal and the plan in force on its date — never
 * taken from the client.
 */
export async function setManagerLinePaid(input: {
  manager_id: string;
  source_type: "rental" | "bonus";
  source_id: string;
  paid: boolean;
}): Promise<Result> {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!(await hasFeature("manager_commission"))) return { ok: false, error: NOT_ENABLED };

  const parsed = managerLinePaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment line." };
  const { manager_id, source_type, source_id, paid } = parsed.data;

  const supabase = createSupabaseServerClient();

  if (!paid) {
    const { error } = await supabase
      .from("manager_commission_payments")
      .delete()
      .eq("tenant_id", profile.tenant_id)
      .eq("manager_id", manager_id)
      .eq("source_type", source_type)
      .eq("source_id", source_id);
    if (error) return { ok: false, error: error.message };
    revalidateManagerViews(manager_id);
    return { ok: true };
  }

  // Load the deal.
  let agentId: string;
  let day: string;
  let base: number;
  let earned: boolean;
  if (source_type === "rental") {
    const { data: rental, error } = await supabase
      .from("rental_codes")
      .select("date, consultation_fee_amount, payment_method, vat_applies, status, assisted_by_agent_id")
      .eq("tenant_id", profile.tenant_id)
      .eq("id", source_id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!rental) return { ok: false, error: "Rental not found." };
    agentId = rental.assisted_by_agent_id;
    day = dayOf(rental.date);
    base = computeRentalNet(rental.consultation_fee_amount, rental.payment_method, rental.vat_applies);
    earned = ["approved", "paid"].includes(rental.status);
  } else {
    const { data: bonus, error } = await supabase
      .from("bonuses")
      .select("amount_owed, bonus_date, created_at, status, agent_id")
      .eq("tenant_id", profile.tenant_id)
      .eq("id", source_id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!bonus) return { ok: false, error: "Bonus not found." };
    agentId = bonus.agent_id;
    day = dayOf(bonus.bonus_date ?? bonus.created_at);
    base = roundMoney(Number(bonus.amount_owed ?? 0));
    earned = ["approved", "sent", "paid"].includes(bonus.status);
  }

  if (!earned) {
    return { ok: false, error: `This ${source_type} hasn't been approved yet, so the manager's cut can't be paid.` };
  }

  // The plan version covering that agent on that day.
  const { data: planRows, error: planError } = await supabase
    .from("manager_commission_plans")
    .select("id, manager_id, commission_percent, applies_to, effective_from, effective_to, manager_commission_pool(agent_id, commission_percent)")
    .eq("tenant_id", profile.tenant_id)
    .eq("manager_id", manager_id)
    .lte("effective_from", day)
    .or(`effective_to.is.null,effective_to.gte.${day}`);
  if (planError) return { ok: false, error: planError.message };

  const plans: ManagerPlan[] = (planRows ?? []).map((row) => {
    const pool = (row.manager_commission_pool ?? []) as {
      agent_id: string;
      commission_percent: number | string | null;
    }[];
    return {
      id: row.id,
      manager_id: row.manager_id,
      commission_percent: Number(row.commission_percent),
      applies_to: row.applies_to as ManagerAppliesTo,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      agent_ids: pool.map((p) => p.agent_id),
      agent_rates: Object.fromEntries(
        pool.filter((p) => p.commission_percent !== null).map((p) => [p.agent_id, Number(p.commission_percent)])
      ),
    };
  });
  const plan = planFor(plans, agentId, day);
  const covered =
    plan &&
    (source_type === "rental" ? plan.applies_to !== "bonuses" : plan.applies_to !== "rentals");
  if (!plan || !covered) {
    return { ok: false, error: "This deal isn't covered by the manager's terms on that date." };
  }

  const { error } = await supabase.from("manager_commission_payments").upsert(
    {
      tenant_id: profile.tenant_id,
      manager_id,
      source_type,
      source_id,
      amount_gbp: managerCut(base, percentFor(plan, agentId)),
      paid_at: new Date().toISOString(),
      paid_by: profile.id,
    },
    { onConflict: "tenant_id,source_type,source_id,manager_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidateManagerViews(manager_id);
  return { ok: true };
}
