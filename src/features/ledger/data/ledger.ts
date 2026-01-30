import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getLedgerTotals() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("amount_gbp, agent_earning_gbp, type");
  if (error) throw new Error(error.message);
  const totals = data?.reduce(
    (acc, entry) => {
      if (entry.type === "rental_net") {
        acc.revenue += entry.amount_gbp ?? 0;
      }
      if (["agent_earning", "marketing_fee"].includes(entry.type)) {
        acc.earnings += entry.agent_earning_gbp ?? 0;
      }
      return acc;
    },
    { revenue: 0, earnings: 0 }
  );
  return totals ?? { revenue: 0, earnings: 0 };
}

export async function getLedgerTotalsForAgent(agentId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("amount_gbp, agent_earning_gbp, type")
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  const totals = data?.reduce(
    (acc, entry) => {
      if (entry.type === "rental_net") {
        acc.revenue += entry.amount_gbp ?? 0;
      }
      if (["agent_earning", "marketing_fee"].includes(entry.type)) {
        acc.earnings += entry.agent_earning_gbp ?? 0;
      }
      return acc;
    },
    { revenue: 0, earnings: 0 }
  );
  return totals ?? { revenue: 0, earnings: 0 };
}
