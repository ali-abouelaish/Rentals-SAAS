import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";

export type CommissionRentalRow = {
  id: string;
  created_at: string;
  code: string;
  client_name: string;
  client_phone: string;
  property_address: string;
  payment_method: string;
  rental_amount: number;
  payment_fee: number;
  base_amount: number;
  commission_percent: number;
  marketing_agent_name: string;
  marketing_fee_deducted: number;
  agent_earning: number;
  status: string;
};

export type CommissionBonusRow = {
  id: string;
  code: string | null;
  landlord_name: string;
  amount_owed: number;
  payout_mode: string;
  agent_earning: number;
  status: string;
  created_at: string;
};

export type CommissionPayoutRow = {
  id: string;
  payout_date: string;
  amount_gbp: number;
  notes: string | null;
  created_at: string;
};

type LedgerRow = {
  reference_id: string;
  type: string;
  amount_gbp: number | null;
  agent_earning_gbp: number | null;
  agent_id: string | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function paymentFeeRate(method: string) {
  if (method === "cash") return 0;
  if (method === "transfer") return 0.2;
  if (method === "card") return 0.0175;
  return 0;
}

export async function getCommissionFileData({
  agentId,
  fromIso,
  toIso,
  includeStatuses
}: {
  agentId: string;
  fromIso: string;
  toIso: string;
  includeStatuses: string[];
}) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();

  const { data: agentProfile } = await supabase
    .from("agent_profiles")
    .select("commission_percent")
    .eq("user_id", agentId)
    .single();

  const { data: rentals, error: rentalError } = await supabase
    .from("rental_codes")
    .select(
      "id, code, created_at, consultation_fee_amount, rental_amount_gbp, payment_method, property_address, client_snapshot, status, assisted_by_agent_id, marketing_agent_id"
    )
    .eq("tenant_id", profile.tenant_id)
    .or(`assisted_by_agent_id.eq.${agentId},marketing_agent_id.eq.${agentId}`)
    .in("status", includeStatuses)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });
  if (rentalError) throw new Error(rentalError.message);

  const rentalIds = (rentals ?? []).map((rental) => rental.id);
  const { data: ledgerRows } = rentalIds.length
    ? await supabase
      .from("ledger_entries")
      .select("reference_id, type, amount_gbp, agent_earning_gbp, agent_id")
      .eq("reference_type", "rental_code")
      .in("reference_id", rentalIds)
      .in("type", ["rental_net", "agent_earning", "marketing_fee"])
    : { data: [] as LedgerRow[] };

  const rentalNetById = new Map<string, number>();
  const marketingFeeById = new Map<string, number>();
  const agentEarningById = new Map<string, number>();

  (ledgerRows ?? []).forEach((row: LedgerRow) => {
    if (row.type === "rental_net") {
      rentalNetById.set(row.reference_id, Number(row.amount_gbp ?? 0));
    }
    if (row.type === "marketing_fee") {
      const current = marketingFeeById.get(row.reference_id) ?? 0;
      marketingFeeById.set(row.reference_id, current + Number(row.agent_earning_gbp ?? 0));
    }
    if (row.agent_id === agentId && ["agent_earning", "marketing_fee"].includes(row.type)) {
      const current = agentEarningById.get(row.reference_id) ?? 0;
      agentEarningById.set(row.reference_id, current + Number(row.agent_earning_gbp ?? 0));
    }
  });

  const marketingAgentIds = (rentals ?? [])
    .map((rental) => rental.marketing_agent_id)
    .filter((id): id is string => Boolean(id));

  const { data: marketingAgents } = marketingAgentIds.length
    ? await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", marketingAgentIds)
    : { data: [] as { id: string; display_name: string | null }[] };

  const marketingAgentMap = new Map(
    (marketingAgents ?? []).map((agent) => [agent.id, agent.display_name ?? "Agent"])
  );

  const rentalRows: CommissionRentalRow[] = (rentals ?? []).map((rental) => {
    const rentalAmount = Number(
      rental.rental_amount_gbp ?? rental.consultation_fee_amount ?? 0
    );
    const feeRate = paymentFeeRate(rental.payment_method);
    const paymentFee = roundMoney(rentalAmount * feeRate);
    const baseAmount =
      rentalNetById.get(rental.id) ?? roundMoney(rentalAmount - paymentFee);
    const marketingFee = marketingFeeById.get(rental.id) ?? 0;
    const agentEarning = agentEarningById.get(rental.id) ?? 0;
    const marketingAgentName = rental.marketing_agent_id
      ? marketingAgentMap.get(rental.marketing_agent_id) ?? "—"
      : "—";
    const marketingFeeDeducted =
      rental.assisted_by_agent_id === agentId &&
        rental.marketing_agent_id &&
        rental.marketing_agent_id !== agentId
        ? marketingFee
        : 0;

    return {
      id: rental.id,
      created_at: rental.created_at,
      code: rental.code,
      client_name: rental.client_snapshot?.full_name ?? "Client",
      client_phone: rental.client_snapshot?.phone ?? "—",
      property_address: rental.property_address,
      payment_method: rental.payment_method,
      rental_amount: rentalAmount,
      payment_fee: paymentFee,
      base_amount: baseAmount,
      commission_percent: Number(agentProfile?.commission_percent ?? 0),
      marketing_agent_name: marketingAgentName,
      marketing_fee_deducted: roundMoney(marketingFeeDeducted),
      agent_earning: roundMoney(agentEarning),
      status: rental.status
    };
  });

  const { data: bonuses, error: bonusError } = await supabase
    .from("bonuses")
    .select("id, code, amount_owed, payout_mode, status, created_at, landlords(name)")
    .eq("tenant_id", profile.tenant_id)
    .eq("agent_id", agentId)
    .in("status", ["approved", "sent", "paid"])
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });
  if (bonusError) throw new Error(bonusError.message);

  const bonusRows: CommissionBonusRow[] = (bonuses ?? []).map((bonus) => ({
    id: bonus.id,
    code: bonus.code ?? bonus.id,
    landlord_name:
      (Array.isArray(bonus.landlords)
        ? bonus.landlords[0]?.name
        : (bonus.landlords as any)?.name) ?? "Landlord",
    amount_owed: Number(bonus.amount_owed ?? 0),
    payout_mode: bonus.payout_mode,
    agent_earning:
      bonus.payout_mode === "full"
        ? Number(bonus.amount_owed ?? 0)
        : roundMoney(Number(bonus.amount_owed ?? 0) * 0.5),
    status: bonus.status,
    created_at: bonus.created_at
  }));

  const { data: payouts, error: payoutError } = await supabase
    .from("agent_payouts")
    .select("id, payout_date, amount_gbp, notes, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("agent_id", agentId)
    .gte("payout_date", fromIso.slice(0, 10))
    .lte("payout_date", toIso.slice(0, 10))
    .order("payout_date", { ascending: false });
  if (payoutError) throw new Error(payoutError.message);

  const payoutRows: CommissionPayoutRow[] = (payouts ?? []).map((payout) => ({
    id: payout.id,
    payout_date: payout.payout_date,
    amount_gbp: Number(payout.amount_gbp ?? 0),
    notes: payout.notes,
    created_at: payout.created_at
  }));

  return {
    rentalRows,
    bonusRows,
    payoutRows
  };
}
