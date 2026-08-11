"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveMappingSchema } from "../domain/schemas";
import type { ColumnMap, SheetPreview, SheetRunSummary } from "../domain/types";
import { FeedSourceError } from "../lib/fetch-source";
import { autoDetectMapping } from "../lib/field-map";
import { aiDetectScrape } from "../lib/ai-detect";
import { loadSheet, runLandlordSheet, type SheetLandlord } from "../lib/run-feed";

const SHEET_COLUMNS =
  "id, tenant_id, name, spreadsheet_url, spreadsheet_header_row, spreadsheet_column_map, spreadsheet_key_columns";

function toMessage(err: unknown): string {
  if (err instanceof FeedSourceError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/**
 * Load the landlord through the user's client first, so RLS proves they own it
 * before the admin client (which bypasses RLS) writes anything.
 */
async function loadOwnedLandlord(landlordId: string) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("landlords")
    .select(SHEET_COLUMNS)
    .eq("id", landlordId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as (SheetLandlord & { name: string }) | null;
}

/**
 * Read this landlord's spreadsheet now, instead of waiting for the daily run.
 * Mirrors `runLandlordScraper` for the SpareRoom side.
 */
export async function importLandlordSheet(
  landlordId: string
): Promise<{ ok: true; run: SheetRunSummary } | { ok: false; error: string }> {
  let landlord;
  try {
    landlord = await loadOwnedLandlord(landlordId);
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
  if (!landlord) return { ok: false, error: "Landlord not found." };
  if (!landlord.spreadsheet_url) {
    return { ok: false, error: "This landlord has no spreadsheet link set." };
  }

  const run = await runLandlordSheet(createSupabaseAdminClient(), landlord, "manual");

  revalidatePath(`/landlords/${landlordId}`);
  return { ok: true, run };
}

/**
 * Load the sheet's columns plus the mapping currently stored on the landlord,
 * for the review dialog. `headerRow` (1-based) lets the user re-read against a
 * different header row without saving first.
 */
export async function previewLandlordSheet(
  landlordId: string,
  headerRow?: number
): Promise<{ ok: true; preview: SheetPreview } | { ok: false; error: string }> {
  let landlord;
  try {
    landlord = await loadOwnedLandlord(landlordId);
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
  if (!landlord) return { ok: false, error: "Landlord not found." };
  if (!landlord.spreadsheet_url) {
    return { ok: false, error: "This landlord has no spreadsheet link set." };
  }

  try {
    const sheet = await loadSheet(landlord.spreadsheet_url);

    // Respect an explicit header-row override, then a previously saved one;
    // only when neither is set does the AI get to pick the header row itself.
    const overrideHeaderRow =
      headerRow !== undefined
        ? headerRow - 1
        : (landlord.spreadsheet_header_row ?? undefined);

    // AI-assisted mapping for the review dialog, falling back to the heuristic
    // when the AI is unavailable or returns nothing usable.
    const decision = await aiDetectScrape(
      sheet.rawRows,
      overrideHeaderRow !== undefined ? { forcedHeaderRow: overrideHeaderRow } : {}
    );

    const grid = sheet.buildGrid(decision ? decision.header_row : overrideHeaderRow);
    const suggestions = decision ? decision.suggestions : autoDetectMapping(grid.headers, grid.records);

    return {
      ok: true,
      preview: {
        sheet_name: grid.sheetName,
        header_row: grid.headerRow + 1,
        headers: grid.headers,
        suggestions,
        total_rows: grid.records.length,
        saved_column_map: (landlord.spreadsheet_column_map ?? {}) as ColumnMap,
        saved_key_columns: (landlord.spreadsheet_key_columns ?? []) as string[],
      },
    };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

/**
 * Persist a reviewed mapping and re-import with it, so the user sees the effect
 * of their correction immediately rather than at the next daily run.
 */
export async function saveSheetMapping(
  landlordId: string,
  input: unknown
): Promise<{ ok: true; run: SheetRunSummary } | { ok: false; error: string }> {
  let landlord;
  try {
    landlord = await loadOwnedLandlord(landlordId);
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
  if (!landlord) return { ok: false, error: "Landlord not found." };

  const parsed = saveMappingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Check the mapping and try again." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("landlords")
    .update({
      spreadsheet_header_row: parsed.data.header_row - 1,
      spreadsheet_column_map: parsed.data.column_map,
      spreadsheet_key_columns: parsed.data.key_columns,
    })
    .eq("id", landlordId);
  if (error) return { ok: false, error: error.message };

  const run = await runLandlordSheet(
    createSupabaseAdminClient(),
    {
      ...landlord,
      spreadsheet_header_row: parsed.data.header_row - 1,
      spreadsheet_column_map: parsed.data.column_map,
      spreadsheet_key_columns: parsed.data.key_columns,
    },
    "manual"
  );

  revalidatePath(`/landlords/${landlordId}`);
  return { ok: true, run };
}

/**
 * Detach the spreadsheet. Imported listings are kept — they may already be
 * attached to leads — but the sheet stops being re-read.
 */
export async function clearLandlordSheet(
  landlordId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole([...ADMIN_ROLES]);
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("landlords")
    .update({
      spreadsheet_url: null,
      spreadsheet_column_map: {},
      spreadsheet_key_columns: [],
      spreadsheet_header_row: 0,
      spreadsheet_last_status: null,
      spreadsheet_last_error: null,
      spreadsheet_last_run_at: null,
      spreadsheet_last_row_count: null,
    })
    .eq("id", landlordId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/landlords/${landlordId}`);
  return { ok: true };
}
