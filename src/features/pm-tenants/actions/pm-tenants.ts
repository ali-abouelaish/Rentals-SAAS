"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { pmTenantSchema, type PmTenantFormValues } from "../domain/schemas";

export async function createPmTenant(values: PmTenantFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = pmTenantSchema.parse(values);

  const { data, error } = await supabase
    .from("pm_tenants")
    .insert({ ...payload, tenant_id: profile.tenant_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  return data;
}

export async function updatePmTenant(id: string, values: Partial<PmTenantFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pm_tenants")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  return data;
}

export async function deletePmTenant(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Check for active contracts before deleting
  const { data: contracts } = await supabase
    .from("property_contracts")
    .select("id")
    .eq("pm_tenant_id", id)
    .in("status", ["active", "signed", "notice_given"])
    .limit(1);

  if (contracts && contracts.length > 0) {
    throw new Error("Cannot delete a tenant with active contracts.");
  }

  const { error } = await supabase
    .from("pm_tenants")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
}

export async function updatePmTenantDocuments(
  id: string,
  docs: { passport_photo_url?: string | null; passport_scan_url?: string | null }
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pm_tenants")
    .update({ ...docs, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  return data;
}
