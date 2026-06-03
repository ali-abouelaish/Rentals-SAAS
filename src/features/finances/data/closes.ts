import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { MonthlyClose, MonthlyCloseStatus } from "../domain/closes";

function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache");
}

export async function getCloseForMonth(
  year: number,
  month: number
): Promise<MonthlyClose | null> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("monthly_closes")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as MonthlyClose | null) ?? null;
}

export type CloseInfo = {
  status: MonthlyCloseStatus;
  closed_at: string | null;
  closed_by_name: string | null;
};

export async function getCloseInfoForMonth(
  year: number,
  month: number
): Promise<CloseInfo> {
  const close = await getCloseForMonth(year, month);
  if (!close) {
    return { status: "open", closed_at: null, closed_by_name: null };
  }

  let name: string | null = null;
  if (close.closed_by) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("display_name")
      .eq("id", close.closed_by)
      .maybeSingle();
    name = (data as { display_name: string | null } | null)?.display_name ?? null;
  }

  return { status: close.status, closed_at: close.closed_at, closed_by_name: name };
}

export async function listClosedMonths(): Promise<MonthlyClose[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("monthly_closes")
    .select("*")
    .eq("status", "closed")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as MonthlyClose[];
}
