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
  marketing_agent_names: string;
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

  // Also find rentals where agent is a secondary marketing agent
  const { data: mktJunctionRows } = await supabase
    .from("rental_marketing_agents")
    .select("rental_id")
    .eq("agent_id", agentId);
  const mktRentalIds = (mktJunctionRows ?? []).map(r => r.rental_id);

  const [{ data: agentProfile }, { data: rentals, error: rentalError }] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("commission_percent, marketing_fee")
      .eq("user_id", agentId)
      .single(),
    supabase
      .from("rental_codes")
      .select(
        "id, code, created_at, consultation_fee_amount, rental_amount_gbp, payment_method, property_address, client_snapshot, status, assisted_by_agent_id, marketing_agent_id, marketing_fee_override_gbp"
      )
      .eq("tenant_id", profile.tenant_id)
      .or([
        `assisted_by_agent_id.eq.${agentId}`,
        ...(mktRentalIds.length > 0 ? [`id.in.(${mktRentalIds.join(",")})`] : [])
      ].join(","))
      .in("status", includeStatuses)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
  ]);
  if (rentalError) throw new Error(rentalError.message);

  const selfCommissionPct = agentProfile?.commission_percent ?? 0;

  // Fetch primary marketing agent display names and their fees
  const primaryMarketingAgentIds = [...new Set(
    (rentals ?? []).map((r) => r.marketing_agent_id).filter((id): id is string => Boolean(id))
  )];

  const [{ data: marketingUserProfiles }, { data: marketingAgentProfiles }] = primaryMarketingAgentIds.length
    ? await Promise.all([
        supabase.from("user_profiles").select("id, display_name").in("id", primaryMarketingAgentIds),
        supabase.from("agent_profiles").select("user_id, marketing_fee").in("user_id", primaryMarketingAgentIds)
      ])
    : [{ data: [] as { id: string; display_name: string | null }[] }, { data: [] as { user_id: string; marketing_fee: number | null }[] }];

  const marketingAgentNameMap = new Map(
    (marketingUserProfiles ?? []).map((u) => [u.id, u.display_name ?? "Agent"])
  );
  const marketingFeeProfileMap = new Map(
    (marketingAgentProfiles ?? []).map((p) => [p.user_id, Number(p.marketing_fee ?? 0)])
  );

  // Fetch junction table for all rentals to get counts and all agent names
  const allRentalIds = (rentals ?? []).map(r => r.id);
  const { data: allJunctionRows } = allRentalIds.length > 0
    ? await supabase
        .from("rental_marketing_agents")
        .select("rental_id, agent_id, user_profiles(display_name)")
        .in("rental_id", allRentalIds)
    : { data: [] as { rental_id: string; agent_id: string; user_profiles: { display_name: string | null } | null }[] };

  const jCountMap = new Map<string, number>();
  const jNamesMap = new Map<string, string[]>();
  for (const row of allJunctionRows ?? []) {
    jCountMap.set(row.rental_id, (jCountMap.get(row.rental_id) ?? 0) + 1);
    const names = jNamesMap.get(row.rental_id) ?? [];
    const name = (row.user_profiles as any)?.display_name ?? "Agent";
    names.push(name);
    jNamesMap.set(row.rental_id, names);
  }

  const rentalRows: CommissionRentalRow[] = (rentals ?? []).map((rental) => {
    const rentalAmount = Number(rental.rental_amount_gbp ?? rental.consultation_fee_amount ?? 0);
    const feeRate = paymentFeeRate(rental.payment_method);
    const paymentFee = roundMoney(rentalAmount * feeRate);
    const baseAmount = roundMoney(rentalAmount - paymentFee);

    const hasMarketingAgent =
      rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id;
    const totalMarketingFee = hasMarketingAgent
      ? rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
        ? Number(rental.marketing_fee_override_gbp)
        : marketingFeeProfileMap.get(rental.marketing_agent_id!) ?? 0
      : 0;

    const agentCount = jCountMap.get(rental.id) ?? 1;
    const splitFee = agentCount > 0 ? roundMoney(totalMarketingFee / agentCount) : 0;
    const commPct = selfCommissionPct;

    let agentEarning: number;
    if (rental.assisted_by_agent_id === agentId) {
      const gross = roundMoney(baseAmount * Number(commPct) / 100);
      agentEarning = roundMoney(gross - totalMarketingFee);
    } else {
      // This agent is one of the marketing agents — earns their split
      agentEarning = splitFee;
    }

    const marketingFeeDeducted =
      rental.assisted_by_agent_id === agentId && hasMarketingAgent ? totalMarketingFee : 0;

    const allMktNames = jNamesMap.get(rental.id) ?? [];
    const marketingAgentNames = allMktNames.length > 0
      ? allMktNames.join(", ")
      : rental.marketing_agent_id
      ? marketingAgentNameMap.get(rental.marketing_agent_id) ?? "—"
      : "—";

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
      commission_percent: Number(commPct),
      marketing_agent_names: marketingAgentNames,
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
