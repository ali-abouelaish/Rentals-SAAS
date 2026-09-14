"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { runLandlordSheet } from "@/features/listing-feeds/lib/run-feed";
import type { SheetRunSummary } from "@/features/listing-feeds/domain/types";
import {
  parseScraperSummary,
  runSpareroomScript,
  SpareroomScriptError,
} from "@/lib/scrapers/runSpareroomScript";

/**
 * Read a landlord's spreadsheet right after their link is saved, so adding the
 * link is all it takes — no second step. Deliberately swallows failures: a bad
 * link must not stop the landlord record from saving. The reason is recorded on
 * `spreadsheet_last_error` by `runLandlordSheet` and shown on the landlord page.
 */
async function importSheetAfterSave(
  landlordId: string,
  tenantId: string,
  spreadsheetUrl: string
): Promise<SheetRunSummary | null> {
  try {
    return await runLandlordSheet(
      createSupabaseAdminClient(),
      {
        id: landlordId,
        tenant_id: tenantId,
        spreadsheet_url: spreadsheetUrl,
        // A newly attached sheet has no confirmed mapping; the run auto-detects
        // both the header row and the column mapping and stores them.
        spreadsheet_header_row: null,
        spreadsheet_column_map: null,
        spreadsheet_key_columns: null,
      },
      "manual"
    );
  } catch (err) {
    console.error("[landlords] sheet import after save failed", err instanceof Error ? err.message : err);
    return null;
  }
}

function parseLandlordFormData(formData: FormData) {
  const paysCommission = String(formData.get("pays_commission") ?? "yes") === "yes";
  const weDoViewing = String(formData.get("we_do_viewing") ?? "yes") === "yes";
  const amountRaw = String(formData.get("commission_amount_gbp") ?? "");
  const amountValue = Number(amountRaw);
  const commissionAmount = Number.isFinite(amountValue) ? amountValue : 0;
  return {
    name: String(formData.get("name") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim() || null,
    billing_address: String(formData.get("billing_address") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    spareroom_profile_url: String(formData.get("spareroom_profile_url") ?? "").trim() || null,
    spreadsheet_url: String(formData.get("spreadsheet_url") ?? "").trim() || null,
    pays_commission: paysCommission,
    commission_amount_gbp: paysCommission ? commissionAmount : 0,
    commission_term_text: String(formData.get("commission_term_text") ?? "").trim() || null,
    we_do_viewing: weDoViewing,
    profile_notes: String(formData.get("profile_notes") ?? "").trim() || null,
  };
}

export async function createLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const payload = parseLandlordFormData(formData);
  const { data, error } = await supabase
    .from("landlords")
    .insert({
      tenant_id: profile.tenant_id,
      name: payload.name,
      contact: payload.contact,
      billing_address: payload.billing_address,
      email: payload.email,
      spareroom_profile_url: payload.spareroom_profile_url,
      spreadsheet_url: payload.spreadsheet_url,
      pays_commission: payload.pays_commission,
      commission_amount_gbp: payload.commission_amount_gbp,
      commission_term_text: payload.commission_term_text,
      we_do_viewing: payload.we_do_viewing,
      profile_notes: payload.profile_notes,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (payload.spreadsheet_url) {
    await importSheetAfterSave(data.id, profile.tenant_id, payload.spreadsheet_url);
  }

  revalidatePath("/landlords");
  redirect(`/landlords/${data.id}`);
}

export async function deleteLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);
  const landlordId = String(formData.get("landlord_id") ?? "");
  if (!landlordId) throw new Error("Missing landlord id.");

  const { error } = await supabase
    .from("landlords")
    .delete()
    .eq("id", landlordId);
  if (error) throw new Error(error.message);

  revalidatePath("/landlords");
  redirect("/landlords");
}

export async function updateLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const landlordId = String(formData.get("landlord_id") ?? "");
  if (!landlordId) throw new Error("Missing landlord id.");

  const payload = parseLandlordFormData(formData);

  // Compare against the stored link so we only re-import when it actually
  // changes — otherwise every unrelated edit would trigger a sheet fetch.
  const { data: existing } = await supabase
    .from("landlords")
    .select("spreadsheet_url")
    .eq("id", landlordId)
    .maybeSingle();
  const sheetChanged = (existing?.spreadsheet_url ?? null) !== payload.spreadsheet_url;

  const { error } = await supabase
    .from("landlords")
    .update({
      name: payload.name,
      contact: payload.contact,
      billing_address: payload.billing_address,
      email: payload.email,
      spareroom_profile_url: payload.spareroom_profile_url,
      spreadsheet_url: payload.spreadsheet_url,
      pays_commission: payload.pays_commission,
      commission_amount_gbp: payload.commission_amount_gbp,
      commission_term_text: payload.commission_term_text,
      we_do_viewing: payload.we_do_viewing,
      profile_notes: payload.profile_notes,
      // A different sheet means the old column mapping is meaningless; clearing
      // it makes the next read auto-detect against the new sheet's headers.
      ...(sheetChanged
        ? {
            spreadsheet_column_map: {},
            spreadsheet_key_columns: [],
            spreadsheet_header_row: 0,
            spreadsheet_last_error: null,
          }
        : {}),
    })
    .eq("id", landlordId);
  if (error) throw new Error(error.message);

  let sheetRun: SheetRunSummary | null = null;
  if (sheetChanged && payload.spreadsheet_url) {
    sheetRun = await importSheetAfterSave(landlordId, profile.tenant_id, payload.spreadsheet_url);
  }

  revalidatePath(`/landlords/${landlordId}`);
  revalidatePath("/landlords");
  return { sheetRun };
}

export async function runLandlordScraper(landlordId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: landlord, error } = await supabase
    .from("landlords")
    .select("id, name, spareroom_profile_url")
    .eq("id", landlordId)
    .single();
  if (error) throw new Error(error.message);
  if (!landlord.spareroom_profile_url) {
    throw new Error("This landlord has no SpareRoom profile URL set.");
  }

  let stdout: string;
  try {
    const res = await runSpareroomScript({ tenantId: profile.tenant_id, landlordId });
    stdout = res.stdout;
  } catch (err) {
    if (!(err instanceof SpareroomScriptError)) throw err;
    // Same failures, said in terms of this landlord and this button.
    switch (err.kind) {
      case "runtime-missing":
        throw new Error(
          "Scraper runtime not available here. On-demand scraping needs Python and the project venv on the host running the app — it works on the production server, but not in local dev without a local Python venv."
        );
      case "timeout":
        throw new Error(
          `Scraper timed out for ${landlord.name} — the profile may have too many listings. The daily run will still pick it up.`
        );
      case "lock-held":
        throw new Error(
          "The scraper is already running (likely the scheduled daily run) — try again in a few minutes."
        );
      default:
        throw new Error(err.message);
    }
  }

  // The run completed (exit 0). Interpret what it actually did.
  if (/unrecognised URL format/i.test(stdout)) {
    throw new Error(
      `${landlord.name}'s SpareRoom URL wasn't recognised. Use a profile link (e.g. https://www.spareroom.co.uk/u123456 or /pro/Name) or a listing link.`
    );
  }
  revalidatePath(`/landlords/${landlordId}`);

  const { posted, swept } = parseScraperSummary(stdout);
  // No summary line means the run bailed before writing: it could not read the
  // profile at all. That is a failure to check, not a finding of "nothing live"
  // — and the difference matters, because we deliberately leave the existing
  // listings in place rather than clearing them on an unreadable source.
  if (posted === null) {
    throw new Error(
      `Couldn't read ${landlord.name}'s SpareRoom profile — it may be blocked, empty, or the URL may be wrong. Their existing listings have been left as they were.`
    );
  }
  // A clean read that found nothing is a real answer, and the dead rows have just
  // been swept — say so, or it looks like the run did nothing.
  if (posted === 0) {
    return {
      count: posted,
      message: `${landlord.name} has no live listings — any previously scraped ones have been removed.`,
    };
  }
  return {
    count: posted,
    message:
      `Scraped ${posted} listing${posted === 1 ? "" : "s"} for ${landlord.name}.` +
      (swept ? ` Removed ${swept} that are no longer live.` : ""),
  };
}
