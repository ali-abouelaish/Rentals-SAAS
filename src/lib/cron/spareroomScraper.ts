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
import {
  parseScraperSummary,
  runSpareroomScript,
  SpareroomScriptError,
} from "@/lib/scrapers/runSpareroomScript";

export type SpareroomScraperTenantResult = {
  tenant_id: string;
  ok: boolean;
  posted: number | null;
  swept: number | null;
  error?: string;
};

export type SpareroomScraperSummary = {
  ok: true;
  tenants: number;
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

export async function runSpareroomScraper(): Promise<SpareroomScraperSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();
  const tenantIds = await tenantsWithRoster(admin);

  const results: SpareroomScraperTenantResult[] = [];

  for (const tenantId of tenantIds) {
    try {
      const { stdout } = await runSpareroomScript({ tenantId });
      const { posted, swept } = parseScraperSummary(stdout);
      // No summary line means the run bailed before writing anything. Rows are
      // left as they were by design, so this is a failure to report, not a
      // successful run that happened to find nothing.
      if (posted === null) {
        results.push({
          tenant_id: tenantId,
          ok: false,
          posted: null,
          swept: null,
          error: "Run produced no summary — nothing was written or swept.",
        });
        continue;
      }
      results.push({ tenant_id: tenantId, ok: true, posted, swept });
    } catch (err) {
      const message =
        err instanceof SpareroomScriptError
          ? `${err.kind}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      // Keep going: one tenant's blocked profile or held lock must not cost the
      // others their daily read.
      console.error(`[cron] spareroom-scraper: tenant ${tenantId} failed`, message);
      results.push({ tenant_id: tenantId, ok: false, posted: null, swept: null, error: message });
    }
  }

  return {
    ok: true,
    tenants: tenantIds.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    posted: results.reduce((sum, r) => sum + (r.posted ?? 0), 0),
    swept: results.reduce((sum, r) => sum + (r.swept ?? 0), 0),
    durationMs: Date.now() - startedAt,
    results,
  };
}
