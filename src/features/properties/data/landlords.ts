import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OwnerLandlord, PropertyManager } from "../domain/types";

export async function getOwnerLandlords(): Promise<OwnerLandlord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("owner_landlords")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Identity + contact for one owner landlord.
 *
 * The property queries only join `id, name`, which is all the list needs; the
 * detail page's landlord contract card also shows how to reach them.
 */
export async function getOwnerLandlordContact(
  id: string
): Promise<Pick<OwnerLandlord, "id" | "name" | "email" | "phone"> | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("owner_landlords")
    .select("id, name, email, phone")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getPropertyManagers(): Promise<PropertyManager[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("manager_landlords")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
