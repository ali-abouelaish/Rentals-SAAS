import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UnitPhoto } from "../domain/types";

/** Communal / property-level photos (unit_id IS NULL) */
export async function getPropertyPhotos(propertyId: string): Promise<UnitPhoto[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("unit_photos")
    .select("*")
    .eq("property_id", propertyId)
    .is("unit_id", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as UnitPhoto[];
}

/** All photos for a property (communal + all room-level) */
export async function getAllPropertyPhotos(propertyId: string): Promise<UnitPhoto[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("unit_photos")
    .select("*")
    .eq("property_id", propertyId)
    .order("unit_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as UnitPhoto[];
}

/** Room-level photos (unit_id IS NOT NULL) */
export async function getUnitPhotos(unitId: string): Promise<UnitPhoto[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("unit_photos")
    .select("*")
    .eq("unit_id", unitId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as UnitPhoto[];
}
