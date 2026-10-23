/**
 * Agency-facing history of full SpareRoom scrapes (spareroom_scrape_runs).
 *
 * Both full-roster entry points go through here — the daily job
 * (src/lib/cron/spareroomScraper.ts) and the "Scrape all now" button
 * (src/features/landlords/actions/scraper-schedule.ts) — so an agency sees the
 * outcome of either on its Landlords page. Split in two because the button
 * must know straight away whether a run could start, but must not wait for it
 * to finish: begin, answer the request, then complete in the background.
 *
 * Service-role client throughout: agency users can read their run rows but have
 * no write policy, so the history can't be forged from the browser.
 *
 * Server-only.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  parseScraperRunDetails,
  runSpareroomScript,
  SCRAPER_LOCK_WAIT_MS,
  SpareroomScriptError,
  STALE_RUN_AFTER_MS,
  type ScraperRunDetails,
} from "./runSpareroomScript";

export type ScrapeRunTrigger = "schedule" | "manual";

export type BeginScrapeRunResult =
  | { ok: true; runId: string }
  | { ok: false; alreadyRunning: true }
  | { ok: false; alreadyRunning: false; error: string };

export type CompleteScrapeRunResult = {
  ok: boolean;
  details: ScraperRunDetails | null;
  error?: string;
};

/**
 * Open a run row. The unique index on running rows (one per tenant) is the
 * guard against overlapping runs, so a clash comes back as `alreadyRunning`
 * rather than an error.
 */
export async function beginScrapeRun(options: {
  tenantId: string;
  trigger: ScrapeRunTrigger;
  startedByName?: string | null;
}): Promise<BeginScrapeRunResult> {
  const admin = createSupabaseAdminClient();

  // A row still "running" past the longest possible run died with its process
  // (deploy, PM2 restart). Close it first, or it would block every later run.
  const staleBefore = new Date(Date.now() - STALE_RUN_AFTER_MS).toISOString();
  await admin
    .from("spareroom_scrape_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message:
        "This run never reported back — the server may have restarted during it. Landlords it reached may still have been refreshed.",
    })
    .eq("tenant_id", options.tenantId)
    .eq("status", "running")
    .lt("started_at", staleBefore);

  const { data, error } = await admin
    .from("spareroom_scrape_runs")
    .insert({
      tenant_id: options.tenantId,
      trigger: options.trigger,
      started_by_name: options.startedByName ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, alreadyRunning: true };
    return { ok: false, alreadyRunning: false, error: error.message };
  }
  return { ok: true, runId: data.id as string };
}

/** The script's failure, said in terms an agency admin can act on. */
function failureMessage(err: unknown): string {
  if (!(err instanceof SpareroomScriptError)) {
    return err instanceof Error ? err.message : String(err);
  }
  switch (err.kind) {
    case "runtime-missing":
      return "The scraper can't run on this server — it needs Python and the project venv. This is expected in local development.";
    case "timeout":
      return "The run took too long and was stopped before saving. Existing listings were left as they were.";
    case "lock-held":
      return "The scraper was busy with another run. Try again in a few minutes.";
    default:
      return `The scraper stopped with an error: ${err.message}`;
  }
}

async function finishRun(
  runId: string,
  status: "success" | "failed",
  details: ScraperRunDetails | null,
  error?: string
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin
      .from("spareroom_scrape_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        landlords_total: details?.landlordsTotal ?? null,
        landlords_refreshed: details?.landlordsRefreshed ?? null,
        listings_posted: details?.posted ?? null,
        listings_swept: details?.swept ?? null,
        unreadable: details?.unreadable ?? [],
        cleared: details?.cleared ?? [],
        error_message: error ?? null,
      })
      .eq("id", runId);
    if (updateError) throw new Error(updateError.message);
  } catch (err) {
    // The scrape itself has finished either way; a lost history row only means
    // the card shows the run as running until it goes stale.
    console.error("[scrape-runs] couldn't record the end of run", runId, err);
  }
}

/**
 * Run the full-roster scrape for one tenant and record how it went. Never
 * throws — the button fires this without awaiting it, so a rejection would be
 * unhandled. `runId` is null when the run couldn't be recorded (the history
 * table isn't migrated yet); the scrape still runs, untracked.
 */
export async function completeScrapeRun(
  runId: string | null,
  tenantId: string,
  options: { waitForLock?: boolean } = {}
): Promise<CompleteScrapeRunResult> {
  let result: CompleteScrapeRunResult;
  try {
    const { stdout } = await runSpareroomScript({
      tenantId,
      waitForLockMs: options.waitForLock ? SCRAPER_LOCK_WAIT_MS : undefined,
    });
    const details = parseScraperRunDetails(stdout);
    // No summary line means the run bailed before writing anything: it could
    // not read a single profile. Rows are left as they were by design, so this
    // is a failure to report, not a run that happened to find nothing.
    result =
      details.posted === null
        ? {
            ok: false,
            details,
            error:
              "Couldn't read any landlord's SpareRoom profile — they may be blocked or the links may be wrong. Existing listings were left as they were.",
          }
        : { ok: true, details };
  } catch (err) {
    const stdout = err instanceof SpareroomScriptError ? err.stdout : "";
    result = {
      ok: false,
      details: stdout ? parseScraperRunDetails(stdout) : null,
      error: failureMessage(err),
    };
  }

  if (!result.ok) {
    console.error(`[scrape-runs] tenant ${tenantId} run failed:`, result.error);
  }
  if (runId) {
    await finishRun(runId, result.ok ? "success" : "failed", result.details, result.error);
  }
  return result;
}
