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
      pro_rata_amount: proRata,
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

  revalidatePath("/contracts");
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
