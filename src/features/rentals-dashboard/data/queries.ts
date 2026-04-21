"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RentalDashboardData = {
  stats: {
    rentalsThisMonth: number;
    revenueThisMonthPence: number;
    pendingCount: number;
    totalClients: number;
  };
  statusBreakdown: { status: string; count: number }[];
  recentRentals: {
    id: string;
    code: string;
    status: string;
    clientName: string;
    agentName: string;
    amount: number;
    date: string;
  }[];
  topAgents: {
    agentId: string;
    agentName: string;
    rentalsCount: number;
    revenueThisMonth: number;
  }[];
};

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getRentalDashboardData(agentId?: string): Promise<RentalDashboardData> {
  const supabase = createSupabaseServerClient();
  const monthStart = startOfMonth();

  // This month's rentals
  let thisMonthQuery = supabase
    .from("rental_codes")
    .select("id, status, consultation_fee_amount, rental_amount_gbp, assisted_by_agent_id")
    .gte("created_at", monthStart);
  if (agentId) thisMonthQuery = thisMonthQuery.eq("assisted_by_agent_id", agentId);
  const { data: thisMonth } = await thisMonthQuery;

  const rentalsThisMonth = thisMonth?.length ?? 0;
  const revenueThisMonthPence = (thisMonth ?? [])
    .filter((r) => r.status === "approved" || r.status === "paid")
    .reduce((sum, r) => {
      const amount = Number(r.rental_amount_gbp ?? r.consultation_fee_amount ?? 0);
      return sum + amount * 100;
    }, 0);

  // Status breakdown
  let allQuery = supabase.from("rental_codes").select("status");
  if (agentId) allQuery = allQuery.eq("assisted_by_agent_id", agentId);
  const { data: allRentals } = await allQuery;
  const statusBreakdown = ["pending", "approved", "paid", "refunded"].map((s) => ({
    status: s,
    count: (allRentals ?? []).filter((r) => r.status === s).length,
  }));
  const pendingCount = statusBreakdown.find((s) => s.status === "pending")?.count ?? 0;

  // Total clients
  const { count: totalClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  // Recent rentals
  let recentQuery = supabase
    .from("rental_codes")
    .select("id, code, status, created_at, consultation_fee_amount, rental_amount_gbp, client_snapshot, user_profiles!rental_codes_assisted_by_agent_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(6);
  if (agentId) recentQuery = recentQuery.eq("assisted_by_agent_id", agentId);
  const { data: recent } = await recentQuery;

  const recentRentals = (recent ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    clientName: (r.client_snapshot as { full_name?: string })?.full_name ?? "Unknown",
    agentName: (r.user_profiles as { display_name?: string } | null)?.display_name ?? "—",
    amount: Number(r.rental_amount_gbp ?? r.consultation_fee_amount ?? 0) * 100,
    date: r.created_at,
  }));

  // Top agents this month (admin only — skip if agent-scoped)
  let topAgents: RentalDashboardData["topAgents"] = [];
  if (!agentId) {
    const { data: agentMonth } = await supabase
      .from("rental_codes")
      .select("assisted_by_agent_id, consultation_fee_amount, rental_amount_gbp, status, user_profiles!rental_codes_assisted_by_agent_id_fkey(id, display_name)")
      .gte("created_at", monthStart);

    const agentMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const r of agentMonth ?? []) {
      const profile = r.user_profiles as { id?: string; display_name?: string } | null;
      const id = r.assisted_by_agent_id;
      const name = profile?.display_name ?? "Unknown";
      const rev =
        r.status === "approved" || r.status === "paid"
          ? Number(r.rental_amount_gbp ?? r.consultation_fee_amount ?? 0) * 100
          : 0;
      const existing = agentMap.get(id) ?? { name, count: 0, revenue: 0 };
      agentMap.set(id, { name, count: existing.count + 1, revenue: existing.revenue + rev });
    }
    topAgents = Array.from(agentMap.entries())
      .map(([id, d]) => ({ agentId: id, agentName: d.name, rentalsCount: d.count, revenueThisMonth: d.revenue }))
      .sort((a, b) => b.rentalsCount - a.rentalsCount)
      .slice(0, 5);
  }

  return {
    stats: {
      rentalsThisMonth,
      revenueThisMonthPence,
      pendingCount,
      totalClients: totalClients ?? 0,
    },
    statusBreakdown,
    recentRentals,
    topAgents,
  };
}
