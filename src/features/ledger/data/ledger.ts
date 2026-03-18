import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";

function computeRentalNet(amount: number, method: string): number {
  const rate = method === "cash" ? 0 : method === "transfer" ? 0.2 : 0.0175;
  return Math.round(amount * (1 - rate) * 100) / 100;
}

export async function getLedgerTotals() {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { data, error } = await supabase
    .from("rental_codes")
    .select("consultation_fee_amount, payment_method")
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["approved", "paid"]);
  if (error) throw new Error(error.message);
  const revenue = (data ?? []).reduce(
    (sum, r) => sum + computeRentalNet(r.consultation_fee_amount, r.payment_method),
    0
  );
  return { revenue, earnings: 0 };
}

export async function getLedgerTotalsForAgent(agentId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rental_codes")
    .select("consultation_fee_amount, payment_method")
    .eq("assisted_by_agent_id", agentId)
    .in("status", ["approved", "paid"]);
  if (error) throw new Error(error.message);
  const revenue = (data ?? []).reduce(
    (sum, r) => sum + computeRentalNet(r.consultation_fee_amount, r.payment_method),
    0
  );
  return { revenue, earnings: 0 };
}
