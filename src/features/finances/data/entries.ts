import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { FinanceEntry } from "../domain/entries";

export async function listEntriesForMonth(
  year: number,
  month: number
): Promise<FinanceEntry[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .order("posted_at", { ascending: false });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("does not exist") || msg.includes("schema cache")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as FinanceEntry[];
}

export type MonthPostInfo = {
  count: number;
  last_posted_at: string | null;
  posted_by_name: string | null;
};

export async function getPostInfoForMonth(
  year: number,
  month: number
): Promise<MonthPostInfo> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { count, error: cErr } = await supabase
    .from("finance_entries")
    .select("id", { count: "exact", head: true })
    .eq("year", year)
    .eq("month", month);
  if (cErr) {
    const msg = cErr.message.toLowerCase();
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      return { count: 0, last_posted_at: null, posted_by_name: null };
    }
    throw new Error(cErr.message);
  }
  if (!count) return { count: 0, last_posted_at: null, posted_by_name: null };

  const { data, error } = await supabase
    .from("finance_entries")
    .select("posted_at, posted_by, posted_by_profile:user_profiles!finance_entries_posted_by_fkey(display_name)")
    .eq("year", year)
    .eq("month", month)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Foreign key alias may not be set up — fall back to a simple query.
    const { data: simple } = await supabase
      .from("finance_entries")
      .select("posted_at")
      .eq("year", year)
      .eq("month", month)
      .order("posted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      count,
      last_posted_at: (simple as { posted_at: string } | null)?.posted_at ?? null,
      posted_by_name: null,
    };
  }

  type Joined = {
    posted_at: string;
    posted_by: string | null;
    posted_by_profile?: { display_name: string | null } | { display_name: string | null }[] | null;
  };
  const row = data as Joined | null;
  const profile = Array.isArray(row?.posted_by_profile)
    ? row?.posted_by_profile[0]
    : row?.posted_by_profile;
  return {
    count,
    last_posted_at: row?.posted_at ?? null,
    posted_by_name: profile?.display_name ?? null,
  };
}
