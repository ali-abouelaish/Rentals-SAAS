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

  // Auto-compute deposit_protection_deadline = start_date + 30 days
  const deadline = format(addDays(new Date(payload.start_date), 30), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("property_contracts")
    .insert({
      ...payload,
      deposit_protection_deadline: deadline,
      tenant_id: profile.tenant_id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/contracts");
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

  // Free the unit so the property looks vacant in lists/Kanban.
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
