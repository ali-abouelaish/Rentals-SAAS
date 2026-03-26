import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Portfolio } from "../domain/types";

export async function getPortfolios(): Promise<Portfolio[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
