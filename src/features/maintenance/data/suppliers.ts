"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MaintenanceSupplier } from "../domain/types";

/** Fetch the tenant's preferred supplier directory, A→Z. */
export async function getAllSuppliers(): Promise<MaintenanceSupplier[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_suppliers")
    .select("id, tenant_id, name, trade, contact_name, phone, email, notes, created_at, updated_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as MaintenanceSupplier[];
}
