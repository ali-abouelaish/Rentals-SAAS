import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { EarningsFilterValues } from "../domain/schemas";
import type { EarningsLeaderboardRow, EarningsStats, EarningsTrendPoint } from "../domain/types";

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
      avatar_url: agent?.agent_profiles?.avatar_url ?? null,
      transactions_count: 0,
      agent_earnings: 0,
      agency_earnings: 0,
      total_earnings: 0,
      last_activity: activityMap.get(agentId) ?? null,
      commission_percent: agent?.agent_profiles?.commission_percent ?? null,
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
