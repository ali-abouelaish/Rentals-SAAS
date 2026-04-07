import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Evaluation } from "../domain/types";
import { MOCK_EVALUATIONS } from "./mock";

export type EvaluationFilters = {
  search?: string;
  portfolioId?: string;
  status?: string;
  area?: string;
  propertyType?: string;
};

export async function getEvaluations(
  filters?: EvaluationFilters
): Promise<Evaluation[]> {
  try {
    const supabase = createSupabaseServerClient();

    let query = supabase
      .from("evaluations")
      .select(
        `*,
        portfolio:portfolios(id, name, color),
        linked_property:properties(id, name)`
      )
      .order("created_at", { ascending: false });

    if (filters?.portfolioId) {
      query = query.eq("portfolio_id", filters.portfolioId);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.area) {
      query = query.eq("detected_area", filters.area);
    }
    if (filters?.propertyType) {
      query = query.eq("property_type", filters.propertyType);
    }
    if (filters?.search) {
      query = query.ilike("address", `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as Evaluation[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isMissing =
      msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("relation");
    if (isMissing) return MOCK_EVALUATIONS;
    throw err;
  }
}

export async function getEvaluationById(id: string): Promise<Evaluation | null> {
  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("evaluations")
      .select(
        `*,
        portfolio:portfolios(id, name, color),
        linked_property:properties(id, name)`
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as Evaluation;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isMissing =
      msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("relation");
    if (isMissing) {
      return MOCK_EVALUATIONS.find((e) => e.id === id) ?? null;
    }
    throw err;
  }
}
