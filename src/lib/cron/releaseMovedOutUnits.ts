// Daily unit-availability housekeeping. A room flagged for move-out carries an
// `available_date` — the day the outgoing tenant vacates and the room frees up.
// Once that date has arrived (Europe/London), the room should show as available
// again without anyone having to flip it by hand. This job does that flip:
//   status "move_out" + available_date <= today  ->  status "available"
//
// Driven by the in-process scheduler (src/lib/cron/scheduler.ts) with an HTTP
// backup at /api/cron/release-units. Runs across all tenants via the admin
// client (no per-user auth context), so it deliberately bypasses RLS — it only
// ever touches rooms already marked move_out whose availability date has passed.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ReleaseMovedOutUnitsSummary = {
  ok: true;
  released: number;
  durationMs: number;
};

/** Today's date as YYYY-MM-DD in Europe/London (handles BST/GMT). */
function londonToday(now: Date): string {
  // en-CA yields ISO-style YYYY-MM-DD, which sorts/compares correctly against
  // the date-only `available_date` column.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function runReleaseMovedOutUnits(
  now: Date = new Date()
): Promise<ReleaseMovedOutUnitsSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();
  const today = londonToday(now);

  // notice_given is cleared alongside the status flip: the move-out has completed,
  // so the pending-notice flag no longer applies to the now-vacant room. Tenant
  // links (pm_tenant_id) are intentionally left untouched — unwinding a tenancy is
  // a separate, heavier action and must not be a side effect of a status flip.
  const { data, error } = await admin
    .from("units")
    .update({
      status: "available",
      notice_given: false,
      updated_at: new Date().toISOString(),
    })
    .eq("status", "move_out")
    .not("available_date", "is", null)
    .lte("available_date", today)
    .select("id");
  if (error) throw new Error(error.message);

  return { ok: true, released: data?.length ?? 0, durationMs: Date.now() - startedAt };
}
