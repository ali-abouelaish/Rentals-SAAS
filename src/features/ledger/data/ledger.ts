import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { computeRentalNet } from "@/features/earnings/lib/money";

export async function getLedgerTotals() {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { data, error } = await supabase
    .from("rental_codes")
    .select("consultation_fee_amount, payment_method, vat_applies")
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["approved", "paid"]);
  if (error) throw new Error(error.message);
  const revenue = (data ?? []).reduce(
    (sum, r) => sum + computeRentalNet(r.consultation_fee_amount, r.payment_method, r.vat_applies),
    0
  );
  return { revenue, earnings: 0 };
}

export async function getLedgerTotalsForAgent(agentId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rental_codes")
    .select("consultation_fee_amount, payment_method, vat_applies")
    .eq("assisted_by_agent_id", agentId)
    .in("status", ["approved", "paid"]);
  if (error) throw new Error(error.message);
  const revenue = (data ?? []).reduce(
    (sum, r) => sum + computeRentalNet(r.consultation_fee_amount, r.payment_method, r.vat_applies),
    0
  );
  return { revenue, earnings: 0 };
}
