"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { guarantorSchema, type GuarantorFormValues } from "../domain/schemas";

export async function createGuarantor(values: GuarantorFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = guarantorSchema.parse(values);

  const { data, error } = await supabase
    .from("guarantors")
    .insert({ ...payload, tenant_id: profile.tenant_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  return data;
}

export async function updateGuarantor(id: string, values: Partial<GuarantorFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("guarantors")
    .update(values)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  return data;
}

export async function deleteGuarantor(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("guarantors")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
}
