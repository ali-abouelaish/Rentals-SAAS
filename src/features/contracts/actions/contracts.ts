"use server";

import { revalidatePath } from "next/cache";
import { addDays, format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { assertContractCloseout } from "@/lib/auth/assertions";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { getUnitTenantHistory } from "../data/tenant-history";
import type { UnitHistory } from "../domain/history";
import {
  contractSchema,
  giveNoticeSchema,
  closeoutSchema,
  type ContractFormValues,
  type GiveNoticeValues,
  type CloseoutValues,
} from "../domain/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

// Statuses where the contract is "live" — i.e. the tenant has actually moved in
// (or will any moment). We only auto-record the move-in payments for these;
// drafts/sent contracts haven't been signed yet, so payment hasn't happened.
const LIVE_STATUSES = new Set(["active", "signed", "notice_given"]);

type MoveInPayment = {
  periodYear: number;
  periodMonth: number;
  amount: number;
};

// Build the single move-in payment implied by the contract's flags. Capped
// at exactly one row (≤ 1 month's rent) to comply with the 2025 fee rules:
//
//   prepaid_first_full_month = true  → Pattern B: £rent_pcm collected at
//     signing, recorded against the first FULL calendar month after move-in.
//     The pro_rata_amount on the contract represents the deferred true-up,
//     paid on the 1st of the next month and recorded manually by the agent.
//
//   pro_rata_amount > 0 (and prepaid flag false) → Pattern A: £pro_rata
//     collected at signing, recorded against the move-in calendar month.
//
//   neither → no auto-recorded payment.
//
// The two flags are mutually exclusive in the UI; if both somehow end up set
// (legacy data from the old illegal "+ next month" pattern), Pattern B wins
// because that's the legally-compliant re-interpretation of "full month at
// signing" — leaving any old rent_payments rows untouched.
function moveInPayments({
  startDate,
  rentPcm,
  proRataAmount,
  prepaidFirstFullMonth,
}: {
  startDate: string;
  rentPcm: number;
  proRataAmount: number | null;
  prepaidFirstFullMonth: boolean;
}): MoveInPayment[] {
  const d = new Date(startDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return [];

  const moveYear = d.getUTCFullYear();
  const moveMonth = d.getUTCMonth() + 1;

  if (prepaidFirstFullMonth && rentPcm > 0) {
    const nextDate = new Date(Date.UTC(moveYear, moveMonth, 1));
    return [
      {
        periodYear: nextDate.getUTCFullYear(),
        periodMonth: nextDate.getUTCMonth() + 1,
        amount: rentPcm,
      },
    ];
  }

  if (proRataAmount != null && proRataAmount > 0) {
    return [{ periodYear: moveYear, periodMonth: moveMonth, amount: proRataAmount }];
  }

  return [];
}

// Insert any move-in payments implied by the contract's current pro-rata /
// prepaid flags that don't already exist as rent_payments rows. We deliberately
// DO NOT overwrite existing rows — they may have been edited by an agent (e.g.
// corrected to the actual amount paid), and clobbering would destroy real
// information. Idempotent: running this on every save is safe.
async function ensureMoveInPayments(
  supabase: SupabaseClient,
  {
    tenantId,
    contractId,
    unitId,
    paidAtIso,
    payments,
  }: {
    tenantId: string;
    contractId: string;
    unitId: string;
    paidAtIso: string;
    payments: MoveInPayment[];
  }
) {
  if (payments.length === 0) return;

  // Fetch existing periods for this contract so we can skip any already recorded.
  const { data: existing, error: fetchErr } = await supabase
    .from("rent_payments")
    .select("period_year, period_month")
    .eq("contract_id", contractId)
    .eq("tenant_id", tenantId);
  if (fetchErr) throw new Error(fetchErr.message);

  const existingKeys = new Set(
    (existing ?? []).map((r) => `${r.period_year}-${r.period_month}`)
  );

  const toInsert = payments.filter(
    (p) => !existingKeys.has(`${p.periodYear}-${p.periodMonth}`)
  );
  if (toInsert.length === 0) return;

  const rows = toInsert.map((p) => ({
    tenant_id: tenantId,
    contract_id: contractId,
    unit_id: unitId,
    period_year: p.periodYear,
    period_month: p.periodMonth,
    amount: p.amount,
    paid_at: paidAtIso,
    notes: "Auto-recorded at contract creation (move-in payment)",
  }));

  const { error } = await supabase.from("rent_payments").insert(rows);
  if (error) throw new Error(error.message);
}

export async function createContract(values: ContractFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = contractSchema.parse(values);

  const deadline = format(addDays(new Date(payload.start_date), 30), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  // A unit is "taken" when another contract on it is still active or in notice.
  // If taken, this new contract is queued — we won't touch the unit until that one closes out.
  const { data: existingActive, error: existErr } = await supabase
    .from("property_contracts")
    .select("id")
    .eq("tenant_id", profile.tenant_id)
    .eq("unit_id", payload.unit_id)
    .in("status", ["active", "notice_given"])
    .limit(1);
  if (existErr) throw new Error(existErr.message);
  const unitIsTaken = (existingActive ?? []).length > 0;

  const startsTodayOrEarlier = payload.start_date <= today;
  const shouldActivateNow = startsTodayOrEarlier && !unitIsTaken;

  // Resolve final contract status:
  //  - shouldActivateNow → force "active" so the unit becomes occupied
  //  - unit is taken but caller asked for "active" → downgrade to "signed" (queued) to avoid two active contracts
  //  - otherwise honour the submitted status
  let contractStatus = payload.status;
  if (shouldActivateNow) {
    contractStatus = "active";
  } else if (unitIsTaken && contractStatus === "active") {
    contractStatus = "signed";
  }

  const proRata =
    payload.pro_rata_amount == null || payload.pro_rata_amount === 0
      ? null
      : payload.pro_rata_amount;

  const { data, error } = await supabase
    .from("property_contracts")
    .insert({
      ...payload,
      expiry_date: payload.expiry_date ? payload.expiry_date : null,
      pro_rata_amount: proRata,
      prepaid_first_full_month: payload.prepaid_first_full_month,
      status: contractStatus,
      deposit_protection_deadline: deadline,
      tenant_id: profile.tenant_id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (shouldActivateNow) {
    const { error: unitErr } = await supabase
      .from("units")
      .update({
        status: "occupied",
        pm_tenant_id: payload.pm_tenant_id,
        notice_given: false,
        available_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.unit_id)
      .eq("tenant_id", profile.tenant_id);
    if (unitErr) throw new Error(unitErr.message);
  }

  // Auto-record move-in payments. Skip for drafts/sent — those haven't been
  // signed yet so the tenant hasn't paid.
  if (LIVE_STATUSES.has(contractStatus)) {
    await ensureMoveInPayments(supabase, {
      tenantId: profile.tenant_id,
      contractId: data.id,
      unitId: payload.unit_id,
      paidAtIso: `${payload.start_date}T12:00:00Z`,
      payments: moveInPayments({
        startDate: payload.start_date,
        rentPcm: payload.rent_pcm,
        proRataAmount: proRata,
        prepaidFirstFullMonth: payload.prepaid_first_full_month,
      }),
    });
  }

  revalidatePath("/contracts");
  revalidatePath("/properties");
  return data;
}

export async function updateContract(id: string, values: Partial<ContractFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Convert empty strings to null for nullable columns so Postgres doesn't reject them
  const nullify = (v: unknown) => (v === "" ? null : v);

  const updates: Record<string, unknown> = {
    ...values,
    updated_at: new Date().toISOString(),
    deposit_scheme_ref: nullify(values.deposit_scheme_ref),
    deposit_protected_date: nullify(values.deposit_protected_date),
    document_url: nullify(values.document_url),
    notes: nullify(values.notes),
    collection_date: values.collection_date || null,
    expiry_date: nullify(values.expiry_date),
  };

  // Only touch pro_rata_amount if the caller actually included it; treat
  // null or 0 as "no pro-rata". This protects partial updates (e.g. deposit
  // tab) from clobbering a previously-set value.
  if ("pro_rata_amount" in values) {
    const v = values.pro_rata_amount;
    updates.pro_rata_amount = v == null || v === 0 ? null : v;
  }

  // Re-compute deadline if start_date changed
  if (values.start_date) {
    updates.deposit_protection_deadline = format(
      addDays(new Date(values.start_date), 30),
      "yyyy-MM-dd"
    );
  }

  const { data, error } = await supabase
    .from("property_contracts")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Backfill move-in payments based on the contract's current state. We never
  // overwrite or delete existing rent_payments rows here — only insert ones
  // that are missing for periods implied by the current pro-rata / prepaid
  // flags. This means turning a toggle off does NOT remove a previously
  // recorded payment (use manual undo for that), but turning one on after the
  // fact correctly creates the missing row.
  if (LIVE_STATUSES.has(data.status)) {
    await ensureMoveInPayments(supabase, {
      tenantId: profile.tenant_id,
      contractId: data.id,
      unitId: data.unit_id,
      paidAtIso: `${data.start_date}T12:00:00Z`,
      payments: moveInPayments({
        startDate: data.start_date,
        rentPcm: Number(data.rent_pcm),
        proRataAmount: data.pro_rata_amount == null ? null : Number(data.pro_rata_amount),
        prepaidFirstFullMonth: !!data.prepaid_first_full_month,
      }),
    });
  }

  revalidatePath("/contracts");
  revalidatePath("/properties");
  return data;
}

export async function giveNotice(id: string, values: GiveNoticeValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = giveNoticeSchema.parse(values);

  // Calculate vacate date: provided override OR notice_given_date + 60 days
  const noticeDateObj = new Date(payload.notice_given_date);
  const vacateDate =
    payload.vacate_date && payload.vacate_date.trim()
      ? payload.vacate_date
      : format(addDays(noticeDateObj, 60), "yyyy-MM-dd");

  // 1. Update contract
  const { data: contract, error: contractError } = await supabase
    .from("property_contracts")
    .update({
      status: "notice_given",
      notice_given_by: payload.notice_given_by,
      notice_given_date: payload.notice_given_date,
      vacate_date: vacateDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("unit_id")
    .single();

  if (contractError || !contract) throw new Error(contractError?.message ?? "Contract not found");

  // 2. Update unit — cascade
  const { error: unitError } = await supabase
    .from("units")
    .update({
      status: "move_out",
      notice_given: true,
      available_date: vacateDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contract.unit_id)
    .eq("tenant_id", profile.tenant_id);

  if (unitError) throw new Error(unitError.message);

  revalidatePath("/contracts");
  revalidatePath("/properties");
  revalidatePath("/tenants");
}

export async function uploadContractDocument(formData: FormData) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const contractId = String(formData.get("contract_id") ?? "");
  const file = formData.get("file") as File;

  if (!contractId || !file?.size) {
    throw new Error("Missing required fields.");
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${profile.tenant_id}/${contractId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("property_contracts")
    .upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage
    .from("property_contracts")
    .getPublicUrl(path);

  const { data, error } = await supabase
    .from("property_contracts")
    .update({ document_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", contractId)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/contracts");
  revalidatePath("/tenants");
  return data;
}

export async function closeoutContract(id: string, values: CloseoutValues) {
  // Tenant scope + role check happens in the assertion.
  const contract = await assertContractCloseout(id);
  const supabase = createSupabaseServerClient();
  const payload = closeoutSchema.parse(values);

  const depositReturnedAt = payload.deposit_returned_at?.toString().trim();

  const { data, error } = await supabase
    .from("property_contracts")
    .update({
      status: "terminated",
      actual_end_date: payload.actual_end_date,
      end_reason: payload.end_reason,
      arrears_at_end: payload.arrears_at_end ?? 0,
      would_relet: payload.would_relet ?? null,
      end_notes: payload.end_notes?.toString().trim() || null,
      deposit_returned:
        payload.deposit_returned == null ? null : payload.deposit_returned,
      deposit_returned_at: depositReturnedAt || null,
      deposit_release_notes:
        payload.deposit_release_notes?.toString().trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // Look for a queued contract on this unit ready to take over (start_date <= today).
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: queuedRows } = await supabase
    .from("property_contracts")
    .select("id, pm_tenant_id, start_date")
    .eq("unit_id", contract.unit_id)
    .neq("id", id)
    .in("status", ["draft", "sent", "signed"])
    .lte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(1);
  const nextContract = queuedRows?.[0] ?? null;

  if (nextContract) {
    const { error: activateErr } = await supabase
      .from("property_contracts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", nextContract.id);
    if (activateErr) throw new Error(activateErr.message);

    const { error: unitError } = await supabase
      .from("units")
      .update({
        status: "occupied",
        notice_given: false,
        pm_tenant_id: nextContract.pm_tenant_id,
        available_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract.unit_id);
    if (unitError) throw new Error(unitError.message);
  } else {
    const { error: unitError } = await supabase
      .from("units")
      .update({
        status: "available",
        notice_given: false,
        pm_tenant_id: null,
        available_date: payload.actual_end_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract.unit_id);
    if (unitError) throw new Error(unitError.message);
  }

  revalidatePath("/contracts");
  revalidatePath("/properties");
  revalidatePath(`/properties/${contract.unit_id}`);
  revalidatePath("/tenants");

  return data;
}

export async function fetchUnitTenantHistory(
  unitId: string
): Promise<{ history: UnitHistory; canCloseout: boolean }> {
  // Tenant scope is enforced inside getUnitTenantHistory via assertTenantHistoryRead.
  const [history, profile] = await Promise.all([
    getUnitTenantHistory(unitId),
    requireUserProfile(),
  ]);
  return { history, canCloseout: isAdminRole(profile.role) };
}

export type PropertyUnitOption = {
  unit_id: string;
  room_number: string | null;
  unit_type: string;
  status: string;
  pm_tenant_id: string | null;
};

export type PropertyWithUnits = {
  property_id: string;
  property_name: string;
  address_line_1: string | null;
  units: PropertyUnitOption[];
};

export async function listPropertiesWithUnits(): Promise<PropertyWithUnits[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("properties")
    .select(
      `id, name, address_line_1,
       units(id, room_number, unit_type, status, pm_tenant_id)`
    )
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => {
    const units = ((p.units ?? []) as Array<{
      id: string;
      room_number: string | null;
      unit_type: string;
      status: string;
      pm_tenant_id: string | null;
    }>).map((u) => ({
      unit_id: u.id,
      room_number: u.room_number,
      unit_type: u.unit_type,
      status: u.status,
      pm_tenant_id: u.pm_tenant_id,
    }));
    units.sort((a, b) => {
      const aLabel = a.room_number ?? a.unit_type;
      const bLabel = b.room_number ?? b.unit_type;
      return aLabel.localeCompare(bLabel, undefined, { numeric: true });
    });
    return {
      property_id: p.id,
      property_name: p.name,
      address_line_1: p.address_line_1 ?? null,
      units,
    };
  });
}

export async function deleteContract(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("property_contracts")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/contracts");
}
