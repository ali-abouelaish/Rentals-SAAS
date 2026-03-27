"use server";

import { revalidatePath } from "next/cache";
import { addDays, format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { contractSchema, giveNoticeSchema, type ContractFormValues, type GiveNoticeValues } from "../domain/schemas";

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

  const updates: Record<string, unknown> = { ...values, updated_at: new Date().toISOString() };

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
