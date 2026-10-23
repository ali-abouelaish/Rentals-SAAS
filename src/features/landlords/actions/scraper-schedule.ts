"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { beginScrapeRun, completeScrapeRun } from "@/lib/scrapers/scrapeRuns";
import { scraperScheduleSchema, type ScraperScheduleValues } from "../domain/schemas";

/**
 * Agency-wide switch for the daily SpareRoom scrape. Off skips the agency in
 * the 09:00 job (src/lib/cron/spareroomScraper.ts) — nothing is written or
 * swept, so existing listings stay as they are and simply age. The on-demand
 * "Run scraper" button on a landlord is unaffected.
 */
export async function setSpareroomScrapeEnabled(
  values: ScraperScheduleValues
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = scraperScheduleSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid setting." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ spareroom_scrape_enabled: parsed.data.enabled })
    .eq("id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/landlords", "layout");
  return { ok: true };
}

/**
 * "Scrape all now": a full-roster scrape for the agency, outside the 09:00
 * schedule. Works while the schedule is paused, like "Run scraper" does.
 *
 * Starts the run and returns at once — a full roster can take most of an hour,
 * far longer than a request lives. The card polls spareroom_scrape_runs for the
 * outcome. Finishing after the response relies on self-hosting: `next start`
 * under PM2 keeps the process (and this promise) alive after the request ends.
 * A serverless host would kill it mid-run.
 */
export async function startSpareroomScrapeNow(): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const supabase = createSupabaseServerClient();
  const { count, error: rosterError } = await supabase
    .from("landlords")
    .select("id", { count: "exact", head: true })
    .not("spareroom_profile_url", "is", null);
  if (rosterError) return { ok: false, error: rosterError.message };
  if (!count) {
    return { ok: false, error: "No landlord has a SpareRoom profile yet, so there's nothing to scrape." };
  }

  const begun = await beginScrapeRun({
    tenantId: profile.tenant_id,
    trigger: "manual",
    startedByName: profile.display_name ?? null,
  });
  if (!begun.ok) {
    return {
      ok: false,
      error: begun.alreadyRunning
        ? "A scrape is already running for your agency. Its result will show here when it finishes."
        : `Couldn't start the scrape: ${begun.error}`,
    };
  }

  // Deliberately not awaited; completeScrapeRun never throws and records its
  // own outcome on the run row.
  void completeScrapeRun(begun.runId, profile.tenant_id);

  revalidatePath("/landlords");
  return { ok: true };
}
