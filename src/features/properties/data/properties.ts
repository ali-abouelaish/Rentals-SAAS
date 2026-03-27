import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Property } from "../domain/types";

export async function getProperties(filters?: {
  portfolioId?: string;
  area?: string;
}): Promise<Property[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("properties")
    .select("*, portfolio:portfolios(id, name, color), owner_landlord:owner_landlords(id, name)")
    .order("name", { ascending: true });

  if (filters?.portfolioId) {
    query = query.eq("portfolio_id", filters.portfolioId);
  }
  if (filters?.area) {
    query = query.eq("area", filters.area);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Property[];
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*, portfolio:portfolios(id, name, color), owner_landlord:owner_landlords(id, name)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Property;
}
