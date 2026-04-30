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

export async function getRentPaymentsForContract(
  contractId: string
): Promise<RentPayment[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rent_payments")
    .select("*")
    .eq("contract_id", contractId)
    .eq("tenant_id", profile.tenant_id)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RentPayment[];
}

export type ArrearsEstimate = {
  expected: number;       // whole pounds
  paid: number;           // whole pounds
  arrears: number;        // max(expected - paid, 0)
  monthsCovered: number;
  rentPcm: number;
  startDate: string;
  endDate: string;
};

/**
 * Estimate arrears at end-of-tenancy from rent_payments.
 * arrears = max(months_covered × rent_pcm − sum(rent_payments.amount), 0)
 *
 * Months covered = inclusive count of calendar months from start_date to endDate.
 */
export async function estimateContractArrears(
  contractId: string,
  endDate: string
): Promise<ArrearsEstimate> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: contract, error: cErr } = await supabase
    .from("property_contracts")
    .select("id, rent_pcm, start_date")
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!contract) throw new Error("Contract not found");

  const { data: payments, error: pErr } = await supabase
    .from("rent_payments")
    .select("amount")
    .eq("contract_id", contractId)
    .eq("tenant_id", profile.tenant_id);
  if (pErr) throw new Error(pErr.message);

  const startDate = contract.start_date as string;
  const rentPcm = Number(contract.rent_pcm ?? 0);
  const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const monthsCovered =
    end < start
      ? 0
      : (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (end.getUTCMonth() - start.getUTCMonth()) +
        1;

  const expected = monthsCovered * rentPcm;
  const arrears = Math.max(0, Math.round(expected - paid));

  return {
    expected: Math.round(expected),
    paid: Math.round(paid),
    arrears,
    monthsCovered,
    rentPcm,
    startDate,
    endDate,
  };
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

  const { data, error } = await supabase
    .from("rent_payments")
    .upsert(
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
    )
    .select("id, period_year, period_month, amount, paid_at, notes")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/properties");
  return data as {
    id: string;
    period_year: number;
    period_month: number;
    amount: number;
    paid_at: string;
    notes: string | null;
  };
}

/**
 * Reverse a recorded rent payment for a given contract + period. Used by the
 * "Paid -> Undo" toggle in the units list when an admin marked a payment by
 * mistake. Returns the deleted payment so the caller can pop it from local state.
 */
export async function undoRentPayment({
  contractId,
  periodYear,
  periodMonth,
}: {
  contractId: string;
  periodYear: number;
  periodMonth: number;
}): Promise<{ ok: true; deletedId: string } | { ok: false; error: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // RLS scopes by tenant_id; the explicit eq is belt-and-braces and lets the
  // SELECT below short-circuit when the row belongs to another agency.
  const { data: existing, error: findErr } = await supabase
    .from("rent_payments")
    .select("id")
    .eq("contract_id", contractId)
    .eq("period_year", periodYear)
    .eq("period_month", periodMonth)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (findErr) return { ok: false, error: findErr.message };
  if (!existing) return { ok: false, error: "No payment found for that period." };

  const { error: deleteErr } = await supabase
    .from("rent_payments")
    .delete()
    .eq("id", existing.id);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  revalidatePath("/properties");
  return { ok: true, deletedId: existing.id as string };
}
