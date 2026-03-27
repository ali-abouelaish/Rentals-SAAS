"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { portfolioSchema, type PortfolioFormValues } from "../domain/schemas";
import type { Portfolio } from "../domain/types";

export async function createPortfolio(values: PortfolioFormValues): Promise<Portfolio> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = portfolioSchema.parse(values);

  const { data, error } = await supabase
    .from("portfolios")
    .insert({ ...payload, tenant_id: profile.tenant_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  return data;
}

export async function deletePortfolio(id: string): Promise<void> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
}
