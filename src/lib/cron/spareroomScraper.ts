// Daily SpareRoom scrape. Previously a crontab entry on the VPS, which meant the
// schedule was invisible from the repo and drifted from the code it ran — the
// deployed script was several builds behind before anyone noticed. It now lives
// alongside the other recurring jobs (src/lib/cron/scheduler.ts), with an HTTP
// backup at /api/cron/spareroom-scraper.
//
// The scrape itself is scripts/OGSCRPAPER.py. Each invocation handles exactly one
// tenant — that is the script's own contract, since every write and every sweep
// it performs is scoped to a single TENANT_ID — so this sweep enumerates the
// tenants with a SpareRoom roster and runs them one after another. Sequential on
// purpose: parallel runs would both contend for the flock and hammer SpareRoom
// from one IP.
//
// Runs across all tenants via the admin client (no per-user auth context), so it
// deliberately bypasses RLS; the script scopes every write to the tenant id it is
// handed.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { beginScrapeRun, completeScrapeRun } from "@/lib/scrapers/scrapeRuns";

export type SpareroomScraperTenantResult = {
  tenant_id: string;
  ok: boolean;
  /** Not run because a manual run for this tenant was already going. */
  skipped?: boolean;
  posted: number | null;
  swept: number | null;
  error?: string;
};

export type SpareroomScraperSummary = {
  ok: true;
  tenants: number;
  /** Tenants with a roster that switched daily scraping off, and were skipped. */
  paused: number;
  /** Tenants skipped because an admin's "Scrape all now" was already running. */
  skippedRunning: number;
  succeeded: number;
  failed: number;
  posted: number;
  swept: number;
  durationMs: number;
  results: SpareroomScraperTenantResult[];
};

/** Tenants holding at least one landlord with a SpareRoom profile URL. */
async function tenantsWithRoster(
  admin: ReturnType<typeof createSupabaseAdminClient>
): Promise<string[]> {
  const { data, error } = await admin
    .from("landlords")
    .select("tenant_id")
    .not("spareroom_profile_url", "is", null);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.tenant_id as string).filter(Boolean))];
}

/**
 * Tenants that switched daily scraping off (tenants.spareroom_scrape_enabled).
 * They are skipped whole, before the script is spawned — so none of its writes
 * or sweeps run and their listings stay exactly as they were. Filtering the
 * profiles API instead would make the script's de-rostered sweep delete them.
 */
async function pausedTenants(
  admin: ReturnType<typeof createSupabaseAdminClient>
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("tenants")
    .select("id")
    .eq("spareroom_scrape_enabled", false);
  if (error) {
    // 42703: column missing until migration 20261022000001 is applied. Nobody
    // can have switched it off yet, so everyone runs — today's behaviour.
    if (error.code === "42703") return new Set();
    throw new Error(error.message);
  }
  return new Set((data ?? []).map((row) => row.id as string));
}

/** Throws when every agency attempted failed — see the end of the function. */
export async function runSpareroomScraper(): Promise<SpareroomScraperSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();
  const [roster, paused] = await Promise.all([tenantsWithRoster(admin), pausedTenants(admin)]);
  const tenantIds = roster.filter((id) => !paused.has(id));

  const results: SpareroomScraperTenantResult[] = [];

  for (const tenantId of tenantIds) {
    // Recorded in spareroom_scrape_runs so the agency sees how its daily run
    // went. An admin's "Scrape all now" already running for this tenant is
    // doing this job, so the tenant is skipped rather than failed.
    const begun = await beginScrapeRun({ tenantId, trigger: "schedule" });
    if (!begun.ok && begun.alreadyRunning) {
      results.push({
        tenant_id: tenantId,
        ok: true,
        skipped: true,
        posted: null,
        swept: null,
        error: "A manual run was already in progress.",
      });
      continue;
    }
    if (!begun.ok) {
      // Most likely the history table isn't migrated yet. The scrape matters
      // more than its record, so it still runs, untracked.
      console.error(`[cron] spareroom-scraper: couldn't record run for tenant ${tenantId}`, begun.error);
    }

    // Never throws. Waits for the lock: it is server-wide, so another agency's
    // manual run would otherwise fail this tenant's daily read outright.
    const outcome = await completeScrapeRun(begun.ok ? begun.runId : null, tenantId, {
      waitForLock: true,
    });
    results.push({
      tenant_id: tenantId,
      ok: outcome.ok,
      posted: outcome.details?.posted ?? null,
      swept: outcome.details?.swept ?? null,
      ...(outcome.error ? { error: outcome.error } : {}),
    });
  }

  const summary: SpareroomScraperSummary = {
    ok: true,
    tenants: tenantIds.length,
    paused: roster.length - tenantIds.length,
    skippedRunning: results.filter((r) => r.skipped).length,
    succeeded: results.filter((r) => r.ok && !r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
    posted: results.reduce((sum, r) => sum + (r.posted ?? 0), 0),
    swept: results.reduce((sum, r) => sum + (r.swept ?? 0), 0),
    durationMs: Date.now() - startedAt,
    results,
  };

  // Every agency failing is an outage, not a mixed day: throw so the job is
  // recorded as failed in /admin/health and reaches Sentry. Returning ok here
  // is how a server with no Python venv logged 25 green days (30 Sep–24 Oct)
  // without scraping anything. Partial failures stay ok — the summary and each
  // agency's own run history carry them.
  if (summary.failed > 0 && summary.succeeded === 0 && summary.skippedRunning === 0) {
    const reasons = [...new Set(results.filter((r) => !r.ok).map((r) => r.error ?? "unknown error"))];
    throw new Error(
      `SpareRoom scrape failed for all ${summary.failed} agenc${summary.failed === 1 ? "y" : "ies"}: ${reasons.join(" | ")}`
    );
  }
  return summary;
}
