// Daily landlord-spreadsheet reads. Re-reads every landlord who has a
// spreadsheet link and upserts the rows into scraped_listings, mirroring what
// the SpareRoom scraper does for landlords with a profile URL. Driven by the
// in-process scheduler (src/lib/cron/scheduler.ts) with an HTTP backup at
// /api/cron/landlord-sheets.
//
// Runs across all tenants via the admin client (no per-user auth context), so it
// deliberately bypasses RLS — every write is explicitly stamped with the
// landlord's own tenant_id.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDue, runLandlordSheet, type SheetLandlord } from "@/features/listing-feeds/lib/run-feed";

/** Ceiling on sheets touched per sweep, so one tenant cannot monopolise the run. */
const MAX_SHEETS_PER_SWEEP = 200;

export type LandlordSheetsSummary = {
  ok: true;
  considered: number;
  ran: number;
  succeeded: number;
  failed: number;
  rowsCreated: number;
  rowsUpdated: number;
  durationMs: number;
};

export async function runLandlordSheets(): Promise<LandlordSheetsSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("landlords")
    .select(
      "id, tenant_id, spreadsheet_url, spreadsheet_header_row, spreadsheet_column_map, spreadsheet_last_run_at"
    )
    .not("spreadsheet_url", "is", null)
    // Oldest first so a sheet that keeps failing cannot starve the others.
    .order("spreadsheet_last_run_at", { ascending: true, nullsFirst: true })
    .limit(MAX_SHEETS_PER_SWEEP);
  if (error) throw new Error(error.message);

  const candidates = (data ?? []) as (SheetLandlord & { spreadsheet_last_run_at: string | null })[];
  const due = candidates.filter((landlord) => isDue(landlord.spreadsheet_last_run_at));

  let succeeded = 0;
  let failed = 0;
  let rowsCreated = 0;
  let rowsUpdated = 0;

  // Sequential on purpose: reads are network-bound against third-party hosts
  // and a burst of parallel requests to Google invites rate limiting.
  for (const landlord of due) {
    try {
      const summary = await runLandlordSheet(admin, landlord, "schedule");
      if (summary.ok) {
        succeeded += 1;
        rowsCreated += summary.rows_created;
        rowsUpdated += summary.rows_updated;
      } else {
        failed += 1;
      }
    } catch (err) {
      // runLandlordSheet records source failures itself; reaching here means the
      // audit write failed. Log and keep going so one bad sheet cannot end the sweep.
      failed += 1;
      console.error(
        `[cron] landlord-sheets: landlord ${landlord.id} threw`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    ok: true,
    considered: candidates.length,
    ran: due.length,
    succeeded,
    failed,
    rowsCreated,
    rowsUpdated,
    durationMs: Date.now() - startedAt,
  };
}
