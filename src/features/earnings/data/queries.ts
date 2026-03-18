import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { EarningsFilterValues } from "../domain/schemas";
import type {
  EarningsLeaderboardRow,
  EarningsStats,
  EarningsTrendPoint,
  EarningsTransaction,
} from "../domain/types";

function getBucket(from: Date, to: Date) {
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 45 ? "day" : "week";
}

function paymentFeeRate(method: string): number {
  if (method === "cash") return 0;
  if (method === "transfer") return 0.2;
  if (method === "card") return 0.0175;
  return 0;
}

function computeRentalNet(amount: number, method: string): number {
  return Math.round(amount * (1 - paymentFeeRate(method)) * 100) / 100;
}

export async function getEarningsStats(filters: EarningsFilterValues): Promise<EarningsStats> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { from, to } = filters;

  const [{ count: totalAgents }, { data: rentals }] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id)
      .eq("is_disabled", false),
    supabase
      .from("rental_codes")
      .select("consultation_fee_amount, payment_method")
      .eq("tenant_id", profile.tenant_id)
      .in("status", ["approved", "paid"])
      .gte("date", from)
      .lte("date", to)
  ]);

  const totalEarnings = (rentals ?? []).reduce(
    (sum, r) => sum + computeRentalNet(r.consultation_fee_amount, r.payment_method),
    0
  );
  const totalTransactions = (rentals ?? []).length;
  const avgPerAgent = totalAgents && totalAgents > 0 ? totalEarnings / totalAgents : 0;

  return {
    totalAgents: totalAgents ?? 0,
    totalEarnings,
    totalTransactions,
    totalRentalsClosed: totalTransactions,
    avgPerAgent
  };
}

export async function getEarningsStatsForAgent(
  filters: EarningsFilterValues,
  agentId: string
): Promise<EarningsStats> {
  const supabase = createSupabaseServerClient();
  const { from, to } = filters;

  const [{ data: agentProfile }, { data: rentals }] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("commission_percent, marketing_fee")
      .eq("user_id", agentId)
      .single(),
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id")
      .or(`assisted_by_agent_id.eq.${agentId},marketing_agent_id.eq.${agentId}`)
      .in("status", ["approved", "paid"])
      .gte("date", from)
      .lte("date", to)
  ]);

  const selfCommissionPct = agentProfile?.commission_percent ?? 0;
  const selfMarketingFee = agentProfile?.marketing_fee ?? 0;

  // Batch-fetch marketing agent profiles for rentals where this agent is assisted agent
  const mktAgentIds = [...new Set(
    (rentals ?? [])
      .filter(r => r.assisted_by_agent_id === agentId && r.marketing_agent_id && r.marketing_agent_id !== agentId)
      .map(r => r.marketing_agent_id as string)
  )];

  const { data: mktProfiles } = mktAgentIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, marketing_fee").in("user_id", mktAgentIds)
    : { data: [] as { user_id: string; marketing_fee: number | null }[] };

  const mktFeeMap = new Map((mktProfiles ?? []).map(p => [p.user_id, Number(p.marketing_fee ?? 0)]));

  let totalEarnings = 0;
  let rentalsCount = 0;

  for (const rental of rentals ?? []) {
    if (rental.assisted_by_agent_id === agentId) {
      rentalsCount++;
      const rentalNet = computeRentalNet(rental.consultation_fee_amount, rental.payment_method);
      const commPct = selfCommissionPct;
      const gross = Math.round(rentalNet * commPct / 100 * 100) / 100;
      const mktFee =
        rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
          ? Number(rental.marketing_fee_override_gbp)
          : (rental.marketing_agent_id && rental.marketing_agent_id !== agentId)
          ? (mktFeeMap.get(rental.marketing_agent_id) ?? 0)
          : 0;
      totalEarnings += Math.round((gross - mktFee) * 100) / 100;
    } else if (rental.marketing_agent_id === agentId) {
      const mktEarned =
        rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
          ? Number(rental.marketing_fee_override_gbp)
          : selfMarketingFee;
      totalEarnings += mktEarned;
    }
  }

  return {
    totalAgents: 1,
    totalEarnings,
    totalTransactions: rentalsCount,
    avgPerAgent: totalEarnings
  };
}

export async function getEarningsTrend(filters: EarningsFilterValues): Promise<EarningsTrendPoint[]> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);
  const bucket = getBucket(fromDate, toDate);

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_earnings_trend", {
    p_tenant_id: profile.tenant_id,
    p_from: fromDate.toISOString(),
    p_to: toDate.toISOString(),
    p_bucket: bucket
  });

  if (!rpcError && rpcData) {
    return rpcData as EarningsTrendPoint[];
  }

  // Fallback: compute from rental_codes
  const { data: rentals } = await supabase
    .from("rental_codes")
    .select("consultation_fee_amount, payment_method, date")
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["approved", "paid"])
    .gte("date", fromDate.toISOString())
    .lte("date", toDate.toISOString());

  const buckets = new Map<string, EarningsTrendPoint>();
  (rentals ?? []).forEach((r) => {
    const date = new Date(r.date);
    const bucketDate =
      bucket === "week"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const key = bucketDate.toISOString().slice(0, 10);
    const current = buckets.get(key) ?? { bucket_date: key, total_earnings: 0, agent_earnings: 0 };
    const rentalNet = computeRentalNet(r.consultation_fee_amount, r.payment_method);
    current.total_earnings += rentalNet;
    buckets.set(key, current);
  });

  return Array.from(buckets.values()).sort((a, b) => a.bucket_date.localeCompare(b.bucket_date));
}

export async function getEarningsTrendForAgent(
  filters: EarningsFilterValues,
  agentId: string
): Promise<EarningsTrendPoint[]> {
  const supabase = createSupabaseServerClient();
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);
  const bucket = getBucket(fromDate, toDate);

  const [{ data: agentProfile }, { data: rentals }] = await Promise.all([
    supabase.from("agent_profiles").select("commission_percent, marketing_fee").eq("user_id", agentId).single(),
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id, date")
      .or(`assisted_by_agent_id.eq.${agentId},marketing_agent_id.eq.${agentId}`)
      .in("status", ["approved", "paid"])
      .gte("date", fromDate.toISOString())
      .lte("date", toDate.toISOString())
  ]);

  const selfCommissionPct = agentProfile?.commission_percent ?? 0;
  const selfMarketingFee = agentProfile?.marketing_fee ?? 0;

  const mktAgentIds = [...new Set(
    (rentals ?? [])
      .filter(r => r.assisted_by_agent_id === agentId && r.marketing_agent_id && r.marketing_agent_id !== agentId)
      .map(r => r.marketing_agent_id as string)
  )];

  const { data: mktProfiles } = mktAgentIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, marketing_fee").in("user_id", mktAgentIds)
    : { data: [] as { user_id: string; marketing_fee: number | null }[] };

  const mktFeeMap = new Map((mktProfiles ?? []).map(p => [p.user_id, Number(p.marketing_fee ?? 0)]));

  const buckets = new Map<string, EarningsTrendPoint>();

  for (const r of rentals ?? []) {
    const date = new Date(r.date);
    const bucketDate =
      bucket === "week"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const key = bucketDate.toISOString().slice(0, 10);
    const current = buckets.get(key) ?? { bucket_date: key, total_earnings: 0, agent_earnings: 0 };

    let earned = 0;
    if (r.assisted_by_agent_id === agentId) {
      const rentalNet = computeRentalNet(r.consultation_fee_amount, r.payment_method);
      const commPct = selfCommissionPct;
      const gross = Math.round(rentalNet * commPct / 100 * 100) / 100;
      const mktFee =
        r.marketing_fee_override_gbp !== null && r.marketing_fee_override_gbp !== undefined
          ? Number(r.marketing_fee_override_gbp)
          : (r.marketing_agent_id && r.marketing_agent_id !== agentId)
          ? (mktFeeMap.get(r.marketing_agent_id) ?? 0)
          : 0;
      earned = Math.round((gross - mktFee) * 100) / 100;
    } else if (r.marketing_agent_id === agentId) {
      earned =
        r.marketing_fee_override_gbp !== null && r.marketing_fee_override_gbp !== undefined
          ? Number(r.marketing_fee_override_gbp)
          : selfMarketingFee;
    }

    current.agent_earnings += earned;
    current.total_earnings = current.agent_earnings;
    buckets.set(key, current);
  }

  return Array.from(buckets.values()).sort((a, b) => a.bucket_date.localeCompare(b.bucket_date));
}

export async function getEarningsLeaderboard(
  filters: EarningsFilterValues
): Promise<EarningsLeaderboardRow[]> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_earnings_leaderboard", {
    p_tenant_id: profile.tenant_id,
    p_from: fromDate.toISOString(),
    p_to: toDate.toISOString()
  });

  if (!rpcError && rpcData) {
    return rpcData as EarningsLeaderboardRow[];
  }

  return buildLeaderboard(supabase, profile.tenant_id, fromDate, toDate, 10);
}

/** Full leaderboard (all agents) for "All Agents" table. */
export async function getEarningsLeaderboardAll(
  filters: EarningsFilterValues
): Promise<EarningsLeaderboardRow[]> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_earnings_leaderboard", {
    p_tenant_id: profile.tenant_id,
    p_from: fromDate.toISOString(),
    p_to: toDate.toISOString()
  });

  if (!rpcError && rpcData) {
    return rpcData as EarningsLeaderboardRow[];
  }

  return buildLeaderboard(supabase, profile.tenant_id, fromDate, toDate, null);
}

async function buildLeaderboard(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenantId: string,
  fromDate: Date,
  toDate: Date,
  limit: number | null
): Promise<EarningsLeaderboardRow[]> {
  const [{ data: rentals }, { data: agents }, { data: activities }] = await Promise.all([
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id")
      .eq("tenant_id", tenantId)
      .in("status", ["approved", "paid"])
      .gte("date", fromDate.toISOString())
      .lte("date", toDate.toISOString()),
    supabase
      .from("user_profiles")
      .select("id, display_name, agent_profiles(avatar_url, commission_percent)")
      .eq("tenant_id", tenantId),
    supabase
      .from("activity_log")
      .select("actor_user_id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", toDate.toISOString())
  ]);

  // Batch-fetch marketing agent profiles
  const mktAgentIds = [...new Set(
    (rentals ?? [])
      .map(r => r.marketing_agent_id)
      .filter((id): id is string => Boolean(id))
  )];
  const { data: mktProfiles } = mktAgentIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, marketing_fee").in("user_id", mktAgentIds)
    : { data: [] as { user_id: string; marketing_fee: number | null }[] };
  const mktFeeMap = new Map((mktProfiles ?? []).map(p => [p.user_id, Number(p.marketing_fee ?? 0)]));

  // Batch-fetch assisted agent profiles for commission percent
  const assistedAgentIds = [...new Set((rentals ?? []).map(r => r.assisted_by_agent_id))];
  const { data: assistedProfiles } = assistedAgentIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, commission_percent").in("user_id", assistedAgentIds)
    : { data: [] as { user_id: string; commission_percent: number | null }[] };
  const commPctMap = new Map((assistedProfiles ?? []).map(p => [p.user_id, Number(p.commission_percent ?? 0)]));

  const activityMap = new Map<string, string>();
  (activities ?? []).forEach((a) => {
    if (!a.actor_user_id) return;
    const existing = activityMap.get(a.actor_user_id);
    if (!existing || new Date(a.created_at) > new Date(existing)) {
      activityMap.set(a.actor_user_id, a.created_at);
    }
  });

  const rows = new Map<string, EarningsLeaderboardRow>();

  const getOrCreate = (agentId: string): EarningsLeaderboardRow => {
    if (rows.has(agentId)) return rows.get(agentId)!;
    const agent = agents?.find((a) => a.id === agentId);
    const row: EarningsLeaderboardRow = {
      agent_id: agentId,
      agent_name: agent?.display_name ?? "Agent",
      avatar_url: Array.isArray(agent?.agent_profiles)
        ? agent.agent_profiles[0]?.avatar_url
        : (agent?.agent_profiles as any)?.avatar_url ?? null,
      transactions_count: 0,
      agent_earnings: 0,
      agency_earnings: 0,
      total_earnings: 0,
      last_activity: activityMap.get(agentId) ?? null,
      commission_percent: Array.isArray(agent?.agent_profiles)
        ? agent.agent_profiles[0]?.commission_percent
        : (agent?.agent_profiles as any)?.commission_percent ?? null,
      rank: 0
    };
    rows.set(agentId, row);
    return row;
  };

  for (const rental of rentals ?? []) {
    const rentalNet = computeRentalNet(rental.consultation_fee_amount, rental.payment_method);
    const commPct = commPctMap.get(rental.assisted_by_agent_id) ?? 0;
    const gross = Math.round(rentalNet * commPct / 100 * 100) / 100;
    const mktFee =
      rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
        ? Number(rental.marketing_fee_override_gbp)
        : (rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id)
        ? (mktFeeMap.get(rental.marketing_agent_id) ?? 0)
        : 0;
    const agentNet = Math.round((gross - mktFee) * 100) / 100;

    // Assisted agent row
    const assistedRow = getOrCreate(rental.assisted_by_agent_id);
    assistedRow.transactions_count += 1;
    assistedRow.total_earnings += rentalNet;
    assistedRow.agent_earnings += agentNet;

    // Marketing agent row
    if (rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id && mktFee > 0) {
      const mktRow = getOrCreate(rental.marketing_agent_id);
      mktRow.agent_earnings += mktFee;
    }
  }

  const sorted = Array.from(rows.values())
    .sort((a, b) => b.agent_earnings - a.agent_earnings)
    .map((row, index) => ({
      ...row,
      agency_earnings: row.total_earnings - row.agent_earnings,
      rank: index + 1
    }));

  return limit ? sorted.slice(0, limit) : sorted;
}

/** Transactions (closed rentals) in range for CSV export and agent profile */
export async function getTransactions(
  filters: EarningsFilterValues,
  options?: { agentId?: string }
): Promise<EarningsTransaction[]> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);

  let query = supabase
    .from("rental_codes")
    .select("id, property_address, licensor_name, assisted_by_agent_id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, date")
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["approved", "paid"])
    .gte("date", fromDate.toISOString())
    .lte("date", toDate.toISOString())
    .order("date", { ascending: false });

  if (options?.agentId) {
    query = query.or(`assisted_by_agent_id.eq.${options.agentId},marketing_agent_id.eq.${options.agentId}`);
  }

  const { data: rentals } = await query;
  if (!rentals || rentals.length === 0) return [];

  // Fetch agent profiles for commission percents
  const assistedIds = [...new Set(rentals.map(r => r.assisted_by_agent_id))];
  const mktIds = [...new Set(rentals.map(r => r.marketing_agent_id).filter((id): id is string => Boolean(id)))];
  const allAgentIds = [...new Set([...assistedIds, ...mktIds])];

  const { data: agentProfiles } = allAgentIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, commission_percent, marketing_fee").in("user_id", allAgentIds)
    : { data: [] as { user_id: string; commission_percent: number | null; marketing_fee: number | null }[] };

  const agentProfileMap = new Map((agentProfiles ?? []).map(p => [p.user_id, p]));

  const out: EarningsTransaction[] = [];

  for (const rental of rentals) {
    const rentalNet = computeRentalNet(rental.consultation_fee_amount, rental.payment_method);
    const commPct = agentProfileMap.get(rental.assisted_by_agent_id)?.commission_percent ?? 0;
    const gross = Math.round(rentalNet * Number(commPct) / 100 * 100) / 100;
    const mktFee =
      rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
        ? Number(rental.marketing_fee_override_gbp)
        : (rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id)
        ? Number(agentProfileMap.get(rental.marketing_agent_id)?.marketing_fee ?? 0)
        : 0;

    let amount: number;
    if (options?.agentId && options.agentId === rental.marketing_agent_id && options.agentId !== rental.assisted_by_agent_id) {
      amount = mktFee;
    } else if (options?.agentId && options.agentId === rental.assisted_by_agent_id) {
      amount = Math.round((gross - mktFee) * 100) / 100;
    } else {
      // All-agents view: total agent payout = gross (assisted net + marketing fee)
      amount = gross;
    }

    out.push({
      id: rental.id,
      agent_id: rental.assisted_by_agent_id,
      property_id: rental.id,
      property_name: rental.property_address ?? "—",
      tenant_name: rental.licensor_name ?? undefined,
      amount,
      rent_amount: rentalNet,
      created_at: rental.date
    });
  }

  return out;
}

/** Trend by agent for Compare Agents chart (top N agents per bucket) */
export async function getEarningsTrendByAgents(
  filters: EarningsFilterValues,
  agentIds: string[]
): Promise<Array<EarningsTrendPoint & { by_agent: Record<string, number> }>> {
  if (agentIds.length === 0) {
    const totalTrend = await getEarningsTrend(filters);
    return totalTrend.map((p) => ({ ...p, by_agent: {} }));
  }

  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);
  const bucket = getBucket(fromDate, toDate);

  const [{ data: rentals }, { data: agentProfiles }] = await Promise.all([
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id, date")
      .eq("tenant_id", profile.tenant_id)
      .or(agentIds.map(id => `assisted_by_agent_id.eq.${id},marketing_agent_id.eq.${id}`).join(","))
      .in("status", ["approved", "paid"])
      .gte("date", fromDate.toISOString())
      .lte("date", toDate.toISOString()),
    supabase
      .from("agent_profiles")
      .select("user_id, commission_percent, marketing_fee")
      .in("user_id", agentIds)
  ]);

  const agentProfileMap = new Map((agentProfiles ?? []).map(p => [p.user_id, p]));

  // Also need marketing agent profiles for non-filter agents referenced by assisted rentals
  const extraMktIds = [...new Set(
    (rentals ?? [])
      .map(r => r.marketing_agent_id)
      .filter((id): id is string => Boolean(id) && !agentIds.includes(id))
  )];
  const { data: extraMktProfiles } = extraMktIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, marketing_fee").in("user_id", extraMktIds)
    : { data: [] as { user_id: string; marketing_fee: number | null }[] };
  const mktFeeMap = new Map([
    ...(agentProfiles ?? []).map(p => [p.user_id, Number(p.marketing_fee ?? 0)] as [string, number]),
    ...(extraMktProfiles ?? []).map(p => [p.user_id, Number(p.marketing_fee ?? 0)] as [string, number])
  ]);

  const buckets = new Map<string, EarningsTrendPoint & { by_agent: Record<string, number> }>();
  const ensureBucket = (key: string) => {
    if (!buckets.has(key)) {
      buckets.set(key, { bucket_date: key, total_earnings: 0, agent_earnings: 0, by_agent: {} });
    }
    return buckets.get(key)!;
  };

  for (const r of rentals ?? []) {
    const date = new Date(r.date);
    const bucketDate =
      bucket === "week"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const key = bucketDate.toISOString().slice(0, 10);
    const b = ensureBucket(key);

    const rentalNet = computeRentalNet(r.consultation_fee_amount, r.payment_method);
    const commPct = agentProfileMap.get(r.assisted_by_agent_id)?.commission_percent ?? 0;
    const gross = Math.round(rentalNet * Number(commPct) / 100 * 100) / 100;
    const mktFee =
      r.marketing_fee_override_gbp !== null && r.marketing_fee_override_gbp !== undefined
        ? Number(r.marketing_fee_override_gbp)
        : (r.marketing_agent_id && r.marketing_agent_id !== r.assisted_by_agent_id)
        ? (mktFeeMap.get(r.marketing_agent_id) ?? 0)
        : 0;

    // Credit assisted agent (if in filter)
    if (agentIds.includes(r.assisted_by_agent_id)) {
      const agentNet = Math.round((gross - mktFee) * 100) / 100;
      b.agent_earnings += agentNet;
      b.total_earnings += agentNet;
      b.by_agent[r.assisted_by_agent_id] = (b.by_agent[r.assisted_by_agent_id] ?? 0) + agentNet;
    }

    // Credit marketing agent (if in filter and different from assisted)
    if (r.marketing_agent_id && agentIds.includes(r.marketing_agent_id) && r.marketing_agent_id !== r.assisted_by_agent_id && mktFee > 0) {
      b.agent_earnings += mktFee;
      b.total_earnings += mktFee;
      b.by_agent[r.marketing_agent_id] = (b.by_agent[r.marketing_agent_id] ?? 0) + mktFee;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.bucket_date.localeCompare(b.bucket_date));
}
