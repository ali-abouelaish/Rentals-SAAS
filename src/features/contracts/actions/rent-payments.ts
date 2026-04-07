"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export type RentPayment = {
  id: string;
  contract_id: string;
  unit_id: string;
  period_year: number;
  period_month: number;
  amount: number;
  paid_at: string;
  notes: string | null;
  created_at: string;
};

export async function getActiveContractForUnit(unitId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("property_contracts")
    .select("id, rent_pcm, collection_date, status")
    .eq("unit_id", unitId)
    .in("status", ["active", "signed", "notice_given"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; rent_pcm: number; collection_date: number | null; status: string } | null;
}

export async function getRentPaymentsForUnit(unitId: string): Promise<RentPayment[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("rent_payments")
    .select("*")
    .eq("unit_id", unitId)
    .eq("tenant_id", profile.tenant_id)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(6);
  return (data ?? []) as RentPayment[];
}

export async function recordRentPayment({
  contractId,
  unitId,
  periodYear,
  periodMonth,
  amount,
  notes,
}: {
  contractId: string;
  unitId: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  notes?: string;
}) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("rent_payments").upsert(
    {
      tenant_id: profile.tenant_id,
      contract_id: contractId,
      unit_id: unitId,
      period_year: periodYear,
      period_month: periodMonth,
      amount,
      notes: notes || null,
      paid_at: new Date().toISOString(),
    },
    { onConflict: "contract_id,period_year,period_month" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/properties");
}
