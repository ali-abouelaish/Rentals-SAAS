import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { EarningsFilterValues } from "../domain/schemas";
import type {
  EarningsLeaderboardRow,
  EarningsStats,
  EarningsTrendPoint,
  EarningsTransaction,
} from "../domain/types";

type LedgerEntry = {
  amount_gbp: number;
  agent_earning_gbp: number | null;
  agent_id: string | null;
  created_at: string;
  type: string;
  reference_id?: string | null;
};

function getBucket(from: Date, to: Date) {
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 45 ? "day" : "week";
}

export async function getEarningsStats(filters: EarningsFilterValues): Promise<EarningsStats> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { from, to } = filters;

  const [{ count: totalAgents }, { data: ledgerEntries }] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id),
    supabase
      .from("ledger_entries")
      .select("amount_gbp, agent_earning_gbp, type, created_at")
      .eq("tenant_id", profile.tenant_id)
      .gte("created_at", from)
      .lte("created_at", to)
  ]);

  const transactions = (ledgerEntries ?? []).filter(
    (entry) => entry.type === "rental_net" && entry.amount_gbp > 0
  );

  const totalEarnings = (ledgerEntries ?? []).reduce((sum, entry) => {
    if (entry.type === "rental_net") {
      return sum + (entry.amount_gbp ?? 0);
    }
    return sum;
  }, 0);

  const avgPerAgent =
    totalAgents && totalAgents > 0 ? totalEarnings / totalAgents : 0;

  return {
    totalAgents: totalAgents ?? 0,
    totalEarnings,
    totalTransactions: transactions.length,
    totalRentalsClosed: transactions.length,
    avgPerAgent
  };
}

export async function getEarningsStatsForAgent(
  filters: EarningsFilterValues,
  agentId: string
): Promise<EarningsStats> {
  const supabase = createSupabaseServerClient();
  const { from, to } = filters;

  const [{ data: ledgerEntries }, { count: rentalsCount }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("agent_earning_gbp, type, created_at")
      .eq("agent_id", agentId)
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("rental_codes")
      .select("id", { count: "exact", head: true })
      .eq("assisted_by_agent_id", agentId)
      .gte("date", from)
      .lte("date", to)
  ]);

  const totalEarnings = (ledgerEntries ?? []).reduce((sum, entry) => {
    if (["agent_earning", "marketing_fee"].includes(entry.type)) {
      return sum + (entry.agent_earning_gbp ?? 0);
    }
    return sum;
  }, 0);

  return {
    totalAgents: 1,
    totalEarnings,
    totalTransactions: rentalsCount ?? 0,
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

  const { data: ledgerEntries } = await supabase
    .from("ledger_entries")
    .select("amount_gbp, agent_earning_gbp, created_at, type")
    .eq("tenant_id", profile.tenant_id)
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());

  const buckets = new Map<string, EarningsTrendPoint>();
  (ledgerEntries ?? []).forEach((entry) => {
    const date = new Date(entry.created_at);
    const bucketDate =
      bucket === "week"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const key = bucketDate.toISOString().slice(0, 10);
    const current = buckets.get(key) ?? {
      bucket_date: key,
      total_earnings: 0,
      agent_earnings: 0
    };
    if (entry.type === "rental_net") {
      current.total_earnings += entry.amount_gbp ?? 0;
    }
    if (["agent_earning", "marketing_fee"].includes(entry.type)) {
      current.agent_earnings += entry.agent_earning_gbp ?? 0;
    }
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

  const { data: ledgerEntries } = await supabase
    .from("ledger_entries")
    .select("agent_earning_gbp, created_at, type")
    .eq("agent_id", agentId)
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());

  const buckets = new Map<string, EarningsTrendPoint>();
  (ledgerEntries ?? []).forEach((entry) => {
    if (!["agent_earning", "marketing_fee"].includes(entry.type)) return;
    const date = new Date(entry.created_at);
    const bucketDate =
      bucket === "week"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const key = bucketDate.toISOString().slice(0, 10);
    const current = buckets.get(key) ?? {
      bucket_date: key,
      total_earnings: 0,
      agent_earnings: 0
    };
    current.agent_earnings += entry.agent_earning_gbp ?? 0;
    current.total_earnings = current.agent_earnings;
    buckets.set(key, current);
  });

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

  const { data: ledgerEntries } = await supabase
    .from("ledger_entries")
    .select("amount_gbp, agent_earning_gbp, agent_id, reference_id, created_at, type")
    .eq("tenant_id", profile.tenant_id)
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());

  const { data: agents } = await supabase
    .from("user_profiles")
    .select("id, display_name, agent_profiles(avatar_url, commission_percent)")
    .eq("tenant_id", profile.tenant_id);

  const activityMap = new Map<string, string>();
  const { data: activities } = await supabase
    .from("activity_log")
    .select("actor_user_id, created_at")
    .eq("tenant_id", profile.tenant_id)
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());
  activities?.forEach((activity) => {
    if (!activity.actor_user_id) return;
    const existing = activityMap.get(activity.actor_user_id);
    if (!existing || new Date(activity.created_at) > new Date(existing)) {
      activityMap.set(activity.actor_user_id, activity.created_at);
    }
  });

  const rows = new Map<string, EarningsLeaderboardRow>();
  const rentalIds = (ledgerEntries ?? [])
    .filter((entry) => entry.type === "rental_net")
    .map((entry) => entry.reference_id)
    .filter(Boolean) as string[];

  const { data: rentals } = await supabase
    .from("rental_codes")
    .select("id, assisted_by_agent_id")
    .in("id", rentalIds);

  const rentalAgentMap = new Map<string, string>();
  rentals?.forEach((rental) => {
    rentalAgentMap.set(rental.id, rental.assisted_by_agent_id);
  });

  (ledgerEntries ?? []).forEach((entry: LedgerEntry & { reference_id?: string }) => {
    let agentId = entry.agent_id;
    if (entry.type === "rental_net" && entry.reference_id) {
      agentId = rentalAgentMap.get(entry.reference_id) ?? null;
    }
    if (!agentId) return;

    const agent = agents?.find((item) => item.id === agentId);
    const existing = rows.get(agentId) ?? {
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
    if (entry.type === "rental_net" && entry.amount_gbp > 0) {
      existing.transactions_count += 1;
      existing.total_earnings += entry.amount_gbp ?? 0;
    }
    if (["agent_earning", "marketing_fee"].includes(entry.type)) {
      existing.agent_earnings += entry.agent_earning_gbp ?? 0;
    }
    rows.set(agentId, existing);
  });

  const sorted = Array.from(rows.values()).sort(
    (a, b) => b.agent_earnings - a.agent_earnings
  );
  return sorted.slice(0, 10).map((row, index) => ({
    ...row,
    agency_earnings: row.total_earnings - row.agent_earnings,
    rank: index + 1
  }));
}

/** Full leaderboard (all agents) for "All Agents" table. Uses same RPC; for >10 need fallback. */
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

  const { data: ledgerEntries } = await supabase
    .from("ledger_entries")
    .select("amount_gbp, agent_earning_gbp, agent_id, reference_id, created_at, type")
    .eq("tenant_id", profile.tenant_id)
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());

  const { data: agents } = await supabase
    .from("user_profiles")
    .select("id, display_name, agent_profiles(avatar_url, commission_percent)")
    .eq("tenant_id", profile.tenant_id);

  const activityMap = new Map<string, string>();
  const { data: activities } = await supabase
    .from("activity_log")
    .select("actor_user_id, created_at")
    .eq("tenant_id", profile.tenant_id)
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());
  activities?.forEach((activity) => {
    if (!activity.actor_user_id) return;
    const existing = activityMap.get(activity.actor_user_id);
    if (!existing || new Date(activity.created_at) > new Date(existing)) {
      activityMap.set(activity.actor_user_id, activity.created_at);
    }
  });

  const rows = new Map<string, EarningsLeaderboardRow>();
  const rentalIds = (ledgerEntries ?? [])
    .filter((entry) => entry.type === "rental_net")
    .map((entry) => entry.reference_id)
    .filter(Boolean) as string[];

  const { data: rentals } = await supabase
    .from("rental_codes")
    .select("id, assisted_by_agent_id")
    .in("id", rentalIds);

  const rentalAgentMap = new Map<string, string>();
  rentals?.forEach((rental) => {
    rentalAgentMap.set(rental.id, rental.assisted_by_agent_id);
  });

  (ledgerEntries ?? []).forEach((entry: LedgerEntry & { reference_id?: string }) => {
    let agentId = entry.agent_id;
    if (entry.type === "rental_net" && entry.reference_id) {
      agentId = rentalAgentMap.get(entry.reference_id) ?? null;
    }
    if (!agentId) return;

    const agent = agents?.find((item) => item.id === agentId);
    const existing = rows.get(agentId) ?? {
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
    if (entry.type === "rental_net" && entry.amount_gbp > 0) {
      existing.transactions_count += 1;
      existing.total_earnings += entry.amount_gbp ?? 0;
    }
    if (["agent_earning", "marketing_fee"].includes(entry.type)) {
      existing.agent_earnings += entry.agent_earning_gbp ?? 0;
    }
    rows.set(agentId, existing);
  });

  const sorted = Array.from(rows.values()).sort(
    (a, b) => b.agent_earnings - a.agent_earnings
  );
  return sorted.map((row, index) => ({
    ...row,
    agency_earnings: row.total_earnings - row.agent_earnings,
    rank: index + 1
  }));
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

  const { data: rentalNetEntries } = await supabase
    .from("ledger_entries")
    .select("id, reference_id, amount_gbp, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("type", "rental_net")
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString())
    .gt("amount_gbp", 0);

  const rentalIds = (rentalNetEntries ?? []).map((e) => e.reference_id).filter(Boolean) as string[];
  if (rentalIds.length === 0) return [];

  let rentalQuery = supabase
    .from("rental_codes")
    .select("id, property_address, licensor_name, assisted_by_agent_id")
    .in("id", rentalIds);
  if (options?.agentId) {
    rentalQuery = rentalQuery.eq("assisted_by_agent_id", options.agentId);
  }
  const { data: rentals } = await rentalQuery;
  const rentalMap = new Map((rentals ?? []).map((r) => [r.id, r]));

  const { data: agentEarnings } = await supabase
    .from("ledger_entries")
    .select("reference_id, agent_earning_gbp")
    .eq("tenant_id", profile.tenant_id)
    .in("type", ["agent_earning", "marketing_fee"])
    .in("reference_id", rentalIds);

  const earningsByRental = new Map<string, number>();
  (agentEarnings ?? []).forEach((e) => {
    const current = earningsByRental.get(e.reference_id) ?? 0;
    earningsByRental.set(e.reference_id, current + (e.agent_earning_gbp ?? 0));
  });

  const out: EarningsTransaction[] = [];
  (rentalNetEntries ?? []).forEach((entry) => {
    const rental = rentalMap.get(entry.reference_id);
    if (!rental) return;
    out.push({
      id: entry.id,
      agent_id: rental.assisted_by_agent_id,
      property_id: rental.id,
      property_name: rental.property_address ?? "—",
      tenant_name: rental.licensor_name ?? undefined,
      amount: earningsByRental.get(entry.reference_id) ?? 0,
      rent_amount: entry.amount_gbp ?? 0,
      created_at: entry.created_at
    });
  });
  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
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

  const { data: entries } = await supabase
    .from("ledger_entries")
    .select("agent_id, agent_earning_gbp, created_at, type")
    .eq("tenant_id", profile.tenant_id)
    .in("agent_id", agentIds)
    .in("type", ["agent_earning", "marketing_fee"])
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());

  const buckets = new Map<string, EarningsTrendPoint & { by_agent: Record<string, number> }>();
  const ensureBucket = (key: string) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        bucket_date: key,
        total_earnings: 0,
        agent_earnings: 0,
        by_agent: {}
      });
    }
    return buckets.get(key)!;
  };

  (entries ?? []).forEach((entry) => {
    const date = new Date(entry.created_at);
    const bucketDate =
      bucket === "week"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const key = bucketDate.toISOString().slice(0, 10);
    const b = ensureBucket(key);
    const amt = entry.agent_earning_gbp ?? 0;
    const aid = entry.agent_id ?? "";
    b.agent_earnings += amt;
    b.total_earnings += amt;
    b.by_agent[aid] = (b.by_agent[aid] ?? 0) + amt;
  });

  return Array.from(buckets.values()).sort((a, b) => a.bucket_date.localeCompare(b.bucket_date));
}
