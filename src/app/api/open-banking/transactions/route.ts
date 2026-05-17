import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";

export async function GET() {
  await requireUserProfile();
  const supabase = createSupabaseServerClient();

  // RLS scopes by tenant_id; explicit ordering by booking_date desc.
  const { data, error } = await supabase
    .from("ob_transactions")
    .select(
      "id, booking_date, amount_pence, currency, credit_debit, debtor_name, remittance_info, match_status, matched_payment_id, account_id"
    )
    .order("booking_date", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ transactions: data ?? [] });
}
