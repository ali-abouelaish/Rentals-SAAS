import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Guard a mutation against being applied to a month that has already been
 * closed via the monthly_closes workflow. Returns `{ ok: true }` when the
 * month is still open (or when monthly_closes hasn't been migrated yet) and
 * `{ error: "Month YYYY-MM is closed" }` otherwise so callers can surface a
 * user-friendly toast.
 *
 * Phase 4 wires this helper through every dated mutation; Phase 5 starts
 * returning errors once monthly_closes exists and a row's status is `closed`.
 */
export async function assertMonthOpen(
  year: number,
  month: number
): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("monthly_closes")
    .select("status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  // If the table doesn't exist yet (pre-Phase 5 deploys), treat as open.
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("does not exist") || msg.includes("schema cache")) {
      return { ok: true };
    }
    // Unexpected error — fail safe by allowing the mutation rather than
    // bricking the page. The DB trigger added in Phase 4 is the belt-and-
    // braces on finance_entries writes.
    return { ok: true };
  }

  if (data?.status === "closed") {
    const label = `${year}-${String(month).padStart(2, "0")}`;
    return { error: `Month ${label} is closed and cannot be edited.` };
  }
  return { ok: true };
}
