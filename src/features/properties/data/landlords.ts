import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OwnerLandlord } from "../domain/types";

export async function getOwnerLandlords(): Promise<OwnerLandlord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("owner_landlords")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
