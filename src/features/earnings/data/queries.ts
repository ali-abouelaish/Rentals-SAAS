import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { EarningsFilterValues } from "../domain/schemas";
import type {
  EarningsLeaderboardRow,
  EarningsStats,
  EarningsTrendPoint,
  EarningsTransaction,
  PaymentRow,
} from "../domain/types";

function getBucket(from: Date, to: Date) {
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 45 ? "day" : "week";
}

/** Turn a date-only string like "2026-04-10" into an end-of-day ISO string
 *  so that `.lte("date", ...)` includes records created during that day. */
function endOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

function paymentFeeRate(method: string): number {
  if (method === "cash") return 0;
  if (method === "transfer") return 0.2;
  if (method === "card") return 0.0175;
  return 0;
}

/** VAT deducted after the payment fee. Currently only card-machine rentals
 *  are subject to VAT (20%). */
function vatRate(method: string): number {
  return method === "card" ? 0.2 : 0;
}

function computeRentalNet(amount: number, method: string): number {
  const afterFee = amount * (1 - paymentFeeRate(method));
  const afterVat = afterFee * (1 - vatRate(method));
  return Math.round(afterVat * 100) / 100;
}

/** Fetch junction table data for a set of rental IDs.
 *  Returns:
 *  - countMap: how many marketing agents are assigned per rental
 *  - agentRentalIds: rental IDs where `agentId` is a marketing agent (if provided)
 */
async function fetchRentalMarketingData(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  rentalIds: string[],
  agentId?: string
): Promise<{ countMap: Map<string, number>; agentRentalIds: Set<string> }> {
  if (rentalIds.length === 0) return { countMap: new Map(), agentRentalIds: new Set() };
  const { data: rows } = await supabase
    .from("rental_marketing_agents")
    .select("rental_id, agent_id")
    .in("rental_id", rentalIds);
  const countMap = new Map<string, number>();
  const agentRentalIds = new Set<string>();
  for (const row of rows ?? []) {
    countMap.set(row.rental_id, (countMap.get(row.rental_id) ?? 0) + 1);
    if (agentId && row.agent_id === agentId) agentRentalIds.add(row.rental_id);
  }
  return { countMap, agentRentalIds };
}

export async function getEarningsStats(filters: EarningsFilterValues): Promise<EarningsStats> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { from, to } = filters;

  const [{ count: totalAgents }, { data: rentals }, { count: totalRentalsPending }] = await Promise.all([
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
      .lte("date", endOfDay(to)),
    supabase
      .from("rental_codes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "pending")
      .gte("date", from)
      .lte("date", endOfDay(to))
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
    totalRentalsPending: totalRentalsPending ?? 0,
    avgPerAgent
  };
}

export async function getEarningsStatsForAgent(
  filters: EarningsFilterValues,
  agentId: string
): Promise<EarningsStats> {
  const supabase = createSupabaseServerClient();
  const { from, to } = filters;

  // Also find rentals where agent is a secondary marketing agent (junction table only)
  const { data: mktJunctionRows } = await supabase
    .from("rental_marketing_agents")
    .select("rental_id")
    .eq("agent_id", agentId);
  const mktRentalIds = (mktJunctionRows ?? []).map(r => r.rental_id);

  const agentOrFilter = [
    `assisted_by_agent_id.eq.${agentId}`,
    `marketing_agent_id.eq.${agentId}`,
    ...(mktRentalIds.length > 0 ? [`id.in.(${mktRentalIds.join(",")})`] : [])
  ].join(",");

  const [{ data: agentProfile }, { data: rentals }, { count: totalRentalsPending }] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("commission_percent, marketing_fee")
      .eq("user_id", agentId)
      .single(),
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id")
      .or(agentOrFilter)
      .in("status", ["approved", "paid"])
      .gte("date", from)
      .lte("date", endOfDay(to)),
    supabase
      .from("rental_codes")
      .select("id", { count: "exact", head: true })
      .or(agentOrFilter)
      .eq("status", "pending")
      .gte("date", from)
      .lte("date", endOfDay(to))
  ]);

  const selfCommissionPct = agentProfile?.commission_percent ?? 0;

  // Fetch marketing agent profiles for primary-agent fee lookup
  const primaryMktIds = [...new Set(
    (rentals ?? [])
      .map(r => r.marketing_agent_id)
      .filter((id): id is string => Boolean(id) && id !== agentId)
  )];
  const { data: mktProfiles } = primaryMktIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, marketing_fee").in("user_id", primaryMktIds)
    : { data: [] as { user_id: string; marketing_fee: number | null }[] };
  const mktFeeMap = new Map((mktProfiles ?? []).map(p => [p.user_id, Number(p.marketing_fee ?? 0)]));

  const rentalIds = (rentals ?? []).map(r => r.id);
  const { countMap, agentRentalIds } = await fetchRentalMarketingData(supabase, rentalIds, agentId);

  let totalEarnings = 0;
  let rentalsCount = 0;

  for (const rental of rentals ?? []) {
    const hasMarketing = rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id;
    const totalMktFee = rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
      ? Number(rental.marketing_fee_override_gbp)
      : hasMarketing
      ? (mktFeeMap.get(rental.marketing_agent_id!) ?? 0)
      : 0;
    const agentCount = countMap.get(rental.id) ?? 1;
    const splitFee = agentCount > 0 ? Math.round(totalMktFee / agentCount * 100) / 100 : 0;
    const isMarketingAgent = agentRentalIds.has(rental.id) || rental.marketing_agent_id === agentId;

    if (rental.assisted_by_agent_id === agentId) {
      rentalsCount++;
      const rentalNet = computeRentalNet(rental.consultation_fee_amount, rental.payment_method);
      const gross = Math.round(rentalNet * selfCommissionPct / 100 * 100) / 100;
      totalEarnings += Math.round((gross - totalMktFee) * 100) / 100;
    } else if (isMarketingAgent) {
      rentalsCount++;
      totalEarnings += splitFee;
    }
  }

  return {
    totalAgents: 1,
    totalEarnings,
    totalTransactions: rentalsCount,
    totalRentalsPending: totalRentalsPending ?? 0,
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
    p_to: endOfDay(filters.to),
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
    .lte("date", endOfDay(filters.to));

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

  const { data: mktJunctionRows } = await supabase
    .from("rental_marketing_agents")
    .select("rental_id")
    .eq("agent_id", agentId);
  const mktRentalIds = (mktJunctionRows ?? []).map(r => r.rental_id);

  const [{ data: agentProfile }, { data: rentals }] = await Promise.all([
    supabase.from("agent_profiles").select("commission_percent, marketing_fee").eq("user_id", agentId).single(),
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id, date")
      .or([
        `assisted_by_agent_id.eq.${agentId}`,
        `marketing_agent_id.eq.${agentId}`,
        ...(mktRentalIds.length > 0 ? [`id.in.(${mktRentalIds.join(",")})`] : [])
      ].join(","))
      .in("status", ["approved", "paid"])
      .gte("date", fromDate.toISOString())
      .lte("date", endOfDay(filters.to))
  ]);

  const selfCommissionPct = agentProfile?.commission_percent ?? 0;

  const primaryMktIds = [...new Set(
    (rentals ?? [])
      .map(r => r.marketing_agent_id)
      .filter((id): id is string => Boolean(id) && id !== agentId)
  )];
  const { data: mktProfiles } = primaryMktIds.length > 0
    ? await supabase.from("agent_profiles").select("user_id, marketing_fee").in("user_id", primaryMktIds)
    : { data: [] as { user_id: string; marketing_fee: number | null }[] };
  const mktFeeMap = new Map((mktProfiles ?? []).map(p => [p.user_id, Number(p.marketing_fee ?? 0)]));

  const rentalIds = (rentals ?? []).map(r => r.id);
  const { countMap, agentRentalIds } = await fetchRentalMarketingData(supabase, rentalIds, agentId);

  const buckets = new Map<string, EarningsTrendPoint>();

  for (const r of rentals ?? []) {
    const date = new Date(r.date);
    const bucketDate =
      bucket === "week"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const key = bucketDate.toISOString().slice(0, 10);
    const current = buckets.get(key) ?? { bucket_date: key, total_earnings: 0, agent_earnings: 0 };

    const hasMarketing = r.marketing_agent_id && r.marketing_agent_id !== r.assisted_by_agent_id;
    const totalMktFee = r.marketing_fee_override_gbp !== null && r.marketing_fee_override_gbp !== undefined
      ? Number(r.marketing_fee_override_gbp)
      : hasMarketing ? (mktFeeMap.get(r.marketing_agent_id!) ?? 0) : 0;
    const agentCount = countMap.get(r.id) ?? 1;
    const splitFee = agentCount > 0 ? Math.round(totalMktFee / agentCount * 100) / 100 : 0;
    const isMarketingAgent = agentRentalIds.has(r.id) || r.marketing_agent_id === agentId;

    let earned = 0;
    if (r.assisted_by_agent_id === agentId) {
      const rentalNet = computeRentalNet(r.consultation_fee_amount, r.payment_method);
      const gross = Math.round(rentalNet * selfCommissionPct / 100 * 100) / 100;
      earned = Math.round((gross - totalMktFee) * 100) / 100;
    } else if (isMarketingAgent) {
      earned = splitFee;
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
    p_to: endOfDay(filters.to)
  });

  if (!rpcError && rpcData) {
    // RPC doesn't return bonus fields — fall through to buildLeaderboard
    // so bonuses are always included
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

  return buildLeaderboard(supabase, profile.tenant_id, fromDate, toDate, null);
}

async function buildLeaderboard(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenantId: string,
  fromDate: Date,
  toDate: Date,
  limit: number | null
): Promise<EarningsLeaderboardRow[]> {
  const toStr = toDate.toISOString().slice(0, 10);
  const [{ data: rentals }, { data: agents }, { data: activities }, { data: bonuses }] = await Promise.all([
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id")
      .eq("tenant_id", tenantId)
      .in("status", ["approved", "paid"])
      .gte("date", fromDate.toISOString())
      .lte("date", endOfDay(toStr)),
    supabase
      .from("user_profiles")
      .select("id, display_name, agent_profiles(avatar_url, commission_percent)")
      .eq("tenant_id", tenantId),
    supabase
      .from("activity_log")
      .select("actor_user_id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", endOfDay(toStr)),
    supabase
      .from("bonuses")
      .select("agent_id, amount_owed, payout_mode")
      .eq("tenant_id", tenantId)
      .gte("bonus_date", fromDate.toISOString().slice(0, 10))
      .lte("bonus_date", toStr)
  ]);

  // Batch-fetch marketing agent profiles for primary fee lookup
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

  // Fetch junction table for all rentals to get agent counts and assignments
  const rentalIds = (rentals ?? []).map(r => r.id);
  const { data: junctionRows } = rentalIds.length > 0
    ? await supabase.from("rental_marketing_agents").select("rental_id, agent_id").in("rental_id", rentalIds)
    : { data: [] as { rental_id: string; agent_id: string }[] };

  const junctionCountMap = new Map<string, number>();
  const junctionAgentsMap = new Map<string, string[]>();
  for (const row of junctionRows ?? []) {
    junctionCountMap.set(row.rental_id, (junctionCountMap.get(row.rental_id) ?? 0) + 1);
    const arr = junctionAgentsMap.get(row.rental_id) ?? [];
    arr.push(row.agent_id);
    junctionAgentsMap.set(row.rental_id, arr);
  }

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
      bonus_earnings: 0,
      combined_earnings: 0,
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
    const hasMarketing = rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id;
    const totalMktFee = rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
      ? Number(rental.marketing_fee_override_gbp)
      : hasMarketing ? (mktFeeMap.get(rental.marketing_agent_id!) ?? 0) : 0;
    const agentNet = Math.round((gross - totalMktFee) * 100) / 100;

    // Assisted agent row
    const assistedRow = getOrCreate(rental.assisted_by_agent_id);
    assistedRow.transactions_count += 1;
    assistedRow.total_earnings += rentalNet;
    assistedRow.agent_earnings += agentNet;

    // Marketing agents: split fee equally among all in junction table
    const mktAgents = junctionAgentsMap.get(rental.id) ?? [];
    const agentCount = junctionCountMap.get(rental.id) ?? 0;
    if (agentCount > 0 && totalMktFee > 0) {
      const splitFee = Math.round(totalMktFee / agentCount * 100) / 100;
      for (const mktAgentId of mktAgents) {
        if (mktAgentId !== rental.assisted_by_agent_id) {
          const mktRow = getOrCreate(mktAgentId);
          mktRow.agent_earnings += splitFee;
        }
      }
    }
  }

  // Add bonus earnings per agent
  for (const bonus of bonuses ?? []) {
    if (!bonus.agent_id) continue;
    const row = getOrCreate(bonus.agent_id);
    const commPct = commPctMap.get(bonus.agent_id) ?? (row.commission_percent ?? 0);
    const bonusShare = bonus.payout_mode === "full"
      ? Number(bonus.amount_owed)
      : Math.round(Number(bonus.amount_owed) * (commPct / 100) * 100) / 100;
    row.bonus_earnings += bonusShare;
  }

  const sorted = Array.from(rows.values())
    .map((row) => ({
      ...row,
      agency_earnings: row.total_earnings - row.agent_earnings,
      combined_earnings: Math.round((row.agent_earnings + row.bonus_earnings) * 100) / 100,
    }))
    .sort((a, b) => b.combined_earnings - a.combined_earnings)
    .map((row, index) => ({
      ...row,
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

  // If filtering by agent, also find rentals where they are a secondary marketing agent
  let mktRentalIds: string[] = [];
  if (options?.agentId) {
    const { data: jRows } = await supabase
      .from("rental_marketing_agents")
      .select("rental_id")
      .eq("agent_id", options.agentId);
    mktRentalIds = (jRows ?? []).map(r => r.rental_id);
  }

  let query = supabase
    .from("rental_codes")
    .select("id, code, status, client_snapshot, assisted_by_agent_id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, date")
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["approved", "paid"])
    .gte("date", fromDate.toISOString())
    .lte("date", endOfDay(filters.to))
    .order("date", { ascending: false });

  if (options?.agentId) {
    const orParts = [
      `assisted_by_agent_id.eq.${options.agentId}`,
      `marketing_agent_id.eq.${options.agentId}`,
    ];
    if (mktRentalIds.length > 0) orParts.push(`id.in.(${mktRentalIds.join(",")})`);
    query = query.or(orParts.join(","));
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

  const rentalIds = rentals.map(r => r.id);
  const { countMap, agentRentalIds } = await fetchRentalMarketingData(supabase, rentalIds, options?.agentId);

  // Per-rental list of marketing agent user IDs (primary on rental_codes + junction rows)
  const { data: junctionRows } = rentalIds.length > 0
    ? await supabase.from("rental_marketing_agents").select("rental_id, agent_id, paid_at").in("rental_id", rentalIds)
    : { data: [] as { rental_id: string; agent_id: string; paid_at: string | null }[] };
  const mktAgentsByRental = new Map<string, Set<string>>();
  const mktPaidByKey = new Map<string, string | null>(); // key: `${rental_id}:${agent_id}` → paid_at
  for (const rental of rentals) {
    const set = new Set<string>();
    if (rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id) {
      set.add(rental.marketing_agent_id);
    }
    mktAgentsByRental.set(rental.id, set);
  }
  for (const row of junctionRows ?? []) {
    const set = mktAgentsByRental.get(row.rental_id);
    if (set) set.add(row.agent_id);
    mktPaidByKey.set(`${row.rental_id}:${row.agent_id}`, row.paid_at);
  }

  const allMktUserIds = [...new Set([...mktAgentsByRental.values()].flatMap(s => [...s]))];
  const { data: mktNameRows } = allMktUserIds.length > 0
    ? await supabase.from("user_profiles").select("id, display_name").in("id", allMktUserIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const mktNameMap = new Map((mktNameRows ?? []).map(r => [r.id, r.display_name ?? "Agent"]));

  const out: EarningsTransaction[] = [];

  for (const rental of rentals) {
    const rentalNet = computeRentalNet(rental.consultation_fee_amount, rental.payment_method);
    const commPct = agentProfileMap.get(rental.assisted_by_agent_id)?.commission_percent ?? 0;
    const gross = Math.round(rentalNet * Number(commPct) / 100 * 100) / 100;
    const hasMarketing = rental.marketing_agent_id && rental.marketing_agent_id !== rental.assisted_by_agent_id;
    const totalMktFee = rental.marketing_fee_override_gbp !== null && rental.marketing_fee_override_gbp !== undefined
      ? Number(rental.marketing_fee_override_gbp)
      : hasMarketing ? Number(agentProfileMap.get(rental.marketing_agent_id!)?.marketing_fee ?? 0) : 0;
    const agentCount = countMap.get(rental.id) ?? 1;
    const splitFee = agentCount > 0 ? Math.round(totalMktFee / agentCount * 100) / 100 : 0;

    let amount: number;
    let role: "assisted" | "marketing" | undefined;
    const isMarketingAgent = agentRentalIds.has(rental.id) || (rental.marketing_agent_id === options?.agentId);
    if (options?.agentId && options.agentId !== rental.assisted_by_agent_id && isMarketingAgent) {
      amount = splitFee;
      role = "marketing";
    } else if (options?.agentId && options.agentId === rental.assisted_by_agent_id) {
      amount = Math.round((gross - totalMktFee) * 100) / 100;
      role = "assisted";
    } else {
      // All-agents view: total agent payout = gross
      amount = gross;
    }

    const mktAgentIds = [...(mktAgentsByRental.get(rental.id) ?? [])];
    const marketing_agents = mktAgentIds
      .map(id => mktNameMap.get(id))
      .filter((n): n is string => Boolean(n));

    // For marketing-role rows, the paid state comes from the junction's paid_at,
    // independent of the rental's overall status (which reflects the assisted payout).
    let rowStatus = rental.status;
    if (role === "marketing" && options?.agentId) {
      const paidAt = mktPaidByKey.get(`${rental.id}:${options.agentId}`);
      rowStatus = paidAt ? "paid" : "approved";
    }

    const assistedNet = Math.round((gross - totalMktFee) * 100) / 100;

    out.push({
      id: rental.id,
      agent_id: rental.assisted_by_agent_id,
      code: rental.code ?? "—",
      client_name: (rental.client_snapshot as { full_name?: string } | null)?.full_name ?? "—",
      amount,
      consultation_fee: Number(rental.consultation_fee_amount ?? 0),
      payment_method: rental.payment_method,
      marketing_agents,
      created_at: rental.date,
      role,
      status: rowStatus,
      payout: {
        rental_amount: Number(rental.consultation_fee_amount ?? 0),
        payment_fee_rate: paymentFeeRate(rental.payment_method),
        vat_rate: vatRate(rental.payment_method),
        base_after_fee_and_vat: rentalNet,
        commission_percent: Number(commPct),
        assisted_gross: gross,
        total_marketing_fee: totalMktFee,
        marketing_agent_count: agentCount,
        split_marketing_fee: splitFee,
        assisted_net: assistedNet,
      },
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

  // Get rental IDs where any of the filter agents is a marketing agent (via junction table)
  const { data: junctionForAgents } = await supabase
    .from("rental_marketing_agents")
    .select("rental_id")
    .in("agent_id", agentIds);
  const mktRentalIds = [...new Set((junctionForAgents ?? []).map(r => r.rental_id))];

  const orParts = [
    ...agentIds.map(id => `assisted_by_agent_id.eq.${id}`),
    ...(mktRentalIds.length > 0 ? [`id.in.(${mktRentalIds.join(",")})`] : [])
  ];

  const [{ data: rentals }, { data: agentProfiles }] = await Promise.all([
    supabase
      .from("rental_codes")
      .select("id, consultation_fee_amount, payment_method, marketing_fee_override_gbp, marketing_agent_id, assisted_by_agent_id, date")
      .eq("tenant_id", profile.tenant_id)
      .or(orParts.join(","))
      .in("status", ["approved", "paid"])
      .gte("date", fromDate.toISOString())
      .lte("date", endOfDay(filters.to)),
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

  // Fetch junction table for all fetched rentals
  const allRentalIds = (rentals ?? []).map(r => r.id);
  const { data: allJunctionRows } = allRentalIds.length > 0
    ? await supabase.from("rental_marketing_agents").select("rental_id, agent_id").in("rental_id", allRentalIds)
    : { data: [] as { rental_id: string; agent_id: string }[] };

  const jCountMap = new Map<string, number>();
  const jAgentsMap = new Map<string, string[]>();
  for (const row of allJunctionRows ?? []) {
    jCountMap.set(row.rental_id, (jCountMap.get(row.rental_id) ?? 0) + 1);
    const arr = jAgentsMap.get(row.rental_id) ?? [];
    arr.push(row.agent_id);
    jAgentsMap.set(row.rental_id, arr);
  }

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
    const hasMarketing = r.marketing_agent_id && r.marketing_agent_id !== r.assisted_by_agent_id;
    const totalMktFee = r.marketing_fee_override_gbp !== null && r.marketing_fee_override_gbp !== undefined
      ? Number(r.marketing_fee_override_gbp)
      : hasMarketing ? (mktFeeMap.get(r.marketing_agent_id!) ?? 0) : 0;
    const agentCount = jCountMap.get(r.id) ?? 1;
    const splitFee = agentCount > 0 ? Math.round(totalMktFee / agentCount * 100) / 100 : 0;
    const mktAgentsForRental = jAgentsMap.get(r.id) ?? [];

    // Credit assisted agent (if in filter)
    if (agentIds.includes(r.assisted_by_agent_id)) {
      const agentNet = Math.round((gross - totalMktFee) * 100) / 100;
      b.agent_earnings += agentNet;
      b.total_earnings += agentNet;
      b.by_agent[r.assisted_by_agent_id] = (b.by_agent[r.assisted_by_agent_id] ?? 0) + agentNet;
    }

    // Credit marketing agents in filter with their split
    for (const mktAgentId of mktAgentsForRental) {
      if (agentIds.includes(mktAgentId) && mktAgentId !== r.assisted_by_agent_id && splitFee > 0) {
        b.agent_earnings += splitFee;
        b.total_earnings += splitFee;
        b.by_agent[mktAgentId] = (b.by_agent[mktAgentId] ?? 0) + splitFee;
      }
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.bucket_date.localeCompare(b.bucket_date));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Outstanding Payments                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export async function getPayments(
  filters: EarningsFilterValues,
  statusFilter: "all" | "paid" | "unpaid" = "all",
): Promise<PaymentRow[]> {
  const profile = await requireUserProfile();
  const supabase = await createSupabaseServerClient();
  const isAdmin = profile.role.toLowerCase() === "admin";
  const toEnd = endOfDay(filters.to);

  // ── Rentals ──────────────────────────────────────────────────────────
  let rentalQuery = supabase
    .from("rental_codes")
    .select("id, code, client_name, assisted_by_agent_id, marketing_agent_id, consultation_fee_amount, date, status, agent_profiles!rental_codes_assisted_by_agent_id_fkey(user_profiles(display_name))")
    .gte("date", filters.from)
    .lte("date", toEnd);

  if (statusFilter === "paid") rentalQuery = rentalQuery.eq("status", "paid");
  else if (statusFilter === "unpaid") rentalQuery = rentalQuery.neq("status", "paid");

  if (!isAdmin) rentalQuery = rentalQuery.eq("assisted_by_agent_id", profile.id);

  const { data: rentals } = await rentalQuery;

  // Build per-rental marketing agent name list (primary + junction, excluding assisted)
  const rentalIds = (rentals ?? []).map((r: any) => r.id);
  const { data: mktJunction } = rentalIds.length > 0
    ? await supabase.from("rental_marketing_agents").select("rental_id, agent_id").in("rental_id", rentalIds)
    : { data: [] as { rental_id: string; agent_id: string }[] };
  const mktIdsByRental = new Map<string, Set<string>>();
  for (const r of (rentals ?? []) as any[]) {
    const set = new Set<string>();
    if (r.marketing_agent_id && r.marketing_agent_id !== r.assisted_by_agent_id) set.add(r.marketing_agent_id);
    mktIdsByRental.set(r.id, set);
  }
  for (const row of mktJunction ?? []) {
    mktIdsByRental.get(row.rental_id)?.add(row.agent_id);
  }
  const allMktIds = [...new Set([...mktIdsByRental.values()].flatMap(s => [...s]))];
  const { data: mktNames } = allMktIds.length > 0
    ? await supabase.from("user_profiles").select("id, display_name").in("id", allMktIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const mktNameMap = new Map((mktNames ?? []).map(n => [n.id, n.display_name ?? "Agent"]));

  const rentalRows: PaymentRow[] = (rentals ?? []).map((r: any) => ({
    id: r.id,
    type: "rental" as const,
    code: r.code ?? "",
    client_name: r.client_name ?? "",
    agent_name: r.agent_profiles?.user_profiles?.display_name ?? "Unknown",
    agent_id: r.assisted_by_agent_id,
    marketing_agents: [...(mktIdsByRental.get(r.id) ?? [])]
      .map(id => mktNameMap.get(id))
      .filter((n): n is string => Boolean(n)),
    amount: Number(r.consultation_fee_amount ?? 0),
    date: r.date,
    status: r.status ?? "approved",
  }));

  // ── Bonuses ──────────────────────────────────────────────────────────
  let bonusQuery = supabase
    .from("bonuses")
    .select("id, client_name, amount_owed, bonus_date, status, agent_id, agent_profiles(user_profiles(display_name))")
    .gte("bonus_date", filters.from)
    .lte("bonus_date", toEnd);

  if (statusFilter === "paid") bonusQuery = bonusQuery.eq("status", "paid");
  else if (statusFilter === "unpaid") bonusQuery = bonusQuery.neq("status", "paid");

  if (!isAdmin) bonusQuery = bonusQuery.eq("agent_id", profile.id);

  const { data: bonuses } = await bonusQuery;

  const bonusRows: PaymentRow[] = (bonuses ?? []).map((b: any) => ({
    id: b.id,
    type: "bonus" as const,
    code: "",
    client_name: b.client_name ?? "",
    agent_name: b.agent_profiles?.user_profiles?.display_name ?? "Unknown",
    agent_id: b.agent_id,
    amount: Number(b.amount_owed ?? 0),
    date: b.bonus_date,
    status: b.status ?? "pending",
  }));

  return [...rentalRows, ...bonusRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
