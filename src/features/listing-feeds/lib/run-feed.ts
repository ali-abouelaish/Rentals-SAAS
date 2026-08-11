/**
 * One read of one landlord's spreadsheet: fetch → parse → map → upsert, wrapped
 * in a `landlord_sheet_runs` audit row.
 *
 * Shared by the "Import now" button, the auto-import that fires when a
 * spreadsheet link is first saved on a landlord, and the daily cron sweep, so
 * all three record identical history. Never throws for a source problem — a
 * failed read is a recorded outcome, not an exception, so one broken sheet
 * cannot abort a sweep across every other landlord.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ColumnMap, SheetGrid, SheetRunSummary } from "../domain/types";
import { FeedSourceError, fetchSource, type ParsedSource } from "./fetch-source";
import { gridFromRows, rawRowsFromBuffer } from "./parse-sheet";
import { importRows } from "./import-rows";
import { autoDetectMapping, backfillNewFields, suggestionsToColumnMap } from "./field-map";
import { aiDetectScrape } from "./ai-detect";

export type SheetLandlord = {
  id: string;
  tenant_id: string;
  spreadsheet_url: string | null;
  spreadsheet_header_row: number | null;
  spreadsheet_column_map: ColumnMap | null;
  spreadsheet_key_columns?: string[] | null;
};

/**
 * A spreadsheet fetched and parsed to raw rows, but not yet committed to a
 * header row. `buildGrid` turns those rows into a `SheetGrid` at a chosen header
 * row (or auto-detects when none is given), so a caller can fetch once, let the
 * AI mapper pick the header row from the raw rows, then build the grid — without
 * a second network round-trip.
 */
export type LoadedSheet = {
  rawRows: string[][];
  sheetName: string | null;
  via: "sheets-api" | "csv";
  apiError: string | null;
  parsed: ParsedSource;
  buildGrid: (headerRow?: number) => SheetGrid;
};

/**
 * Fetch a spreadsheet and parse it to raw rows. Exported so the mapping-review
 * dialog and the importer share the exact fetch/parse path.
 */
export async function loadSheet(sourceUrl: string): Promise<LoadedSheet> {
  const source = await fetchSource(sourceUrl);

  if (source.via === "sheets-api") {
    return {
      rawRows: source.rows,
      sheetName: source.sheetName,
      via: "sheets-api",
      apiError: null,
      parsed: source.parsed,
      buildGrid: (headerRow) => gridFromRows(source.rows, source.sheetName, headerRow, source.links),
    };
  }

  const { rows, sheetName } = rawRowsFromBuffer(source.buffer, source.format, source.parsed.sheetGid);
  return {
    rawRows: rows,
    sheetName,
    via: "csv",
    apiError: source.apiError ?? null,
    parsed: source.parsed,
    buildGrid: (headerRow) => gridFromRows(rows, sheetName, headerRow),
  };
}

/**
 * Fetch and parse a spreadsheet into a grid at a given header row. Retained for
 * callers that only need the grid (e.g. the photo diagnostics).
 */
export async function loadGrid(sourceUrl: string, headerRow?: number) {
  const sheet = await loadSheet(sourceUrl);
  return {
    grid: sheet.buildGrid(headerRow),
    parsed: sheet.parsed,
    via: sheet.via,
    apiError: sheet.apiError,
  };
}

export async function runLandlordSheet(
  admin: SupabaseClient,
  landlord: SheetLandlord,
  trigger: "schedule" | "manual" = "schedule"
): Promise<SheetRunSummary> {
  if (!landlord.spreadsheet_url) {
    return {
      ok: false,
      rows_seen: 0,
      rows_created: 0,
      rows_updated: 0,
      rows_skipped: 0,
      error: "This landlord has no spreadsheet link set.",
    };
  }

  const { data: run, error: runErr } = await admin
    .from("landlord_sheet_runs")
    .insert({
      tenant_id: landlord.tenant_id,
      landlord_id: landlord.id,
      status: "running",
      trigger,
    })
    .select("id")
    .single();
  if (runErr || !run) {
    throw new Error(runErr?.message ?? "Could not start a spreadsheet read.");
  }

  await admin
    .from("landlords")
    .update({ spreadsheet_last_status: "running", spreadsheet_last_run_at: new Date().toISOString() })
    .eq("id", landlord.id);

  const fail = async (message: string): Promise<SheetRunSummary> => {
    await admin
      .from("landlord_sheet_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message.slice(0, 2000),
      })
      .eq("id", run.id);
    await admin
      .from("landlords")
      .update({ spreadsheet_last_status: "failed", spreadsheet_last_error: message.slice(0, 2000) })
      .eq("id", landlord.id);
    return { ok: false, rows_seen: 0, rows_created: 0, rows_updated: 0, rows_skipped: 0, error: message };
  };

  try {
    const storedHeaderRow = landlord.spreadsheet_header_row ?? undefined;
    const sheet = await loadSheet(landlord.spreadsheet_url);
    const readNotes: string[] = [];
    if (sheet.apiError) {
      readNotes.push(
        `Read via CSV export because the Google Sheets API call failed (${sheet.apiError}). Hyperlinked cells lose their link on that path, so photo-folder and listing-link columns may be empty.`
      );
    }

    let columnMap = (landlord.spreadsheet_column_map ?? {}) as ColumnMap;
    let keyColumns = (landlord.spreadsheet_key_columns ?? []) as string[];
    let mapChanged = false;
    let keyColumnsChanged = false;
    let grid: SheetGrid;

    if (Object.keys(columnMap).length === 0) {
      // First read of a newly attached sheet has no confirmed mapping yet. Let
      // the AI read a snapshot and decide the header row, the column mapping and
      // the dedupe key; fall back to the synonym/value-shape heuristics when it
      // is unavailable or returns nothing usable. Whatever is settled here is
      // persisted, and from then on the stored map is replayed — a later read
      // never re-guesses behind the user's back.
      const decision = await aiDetectScrape(sheet.rawRows);
      if (decision) {
        grid = sheet.buildGrid(decision.header_row);
        columnMap = suggestionsToColumnMap(decision.suggestions);
        // Only adopt the AI's row identity when the landlord has none saved.
        if (keyColumns.length === 0) {
          const validKeys = decision.key_columns.filter((h) => grid.headers.includes(h));
          if (validKeys.length > 0) {
            keyColumns = validKeys;
            keyColumnsChanged = true;
          }
        }
      } else {
        grid = sheet.buildGrid(storedHeaderRow);
      }

      if (Object.keys(columnMap).length === 0) {
        columnMap = suggestionsToColumnMap(autoDetectMapping(grid.headers, grid.records));
      }

      mapChanged = true;
      if (Object.keys(columnMap).length === 0) {
        return fail(
          "None of the columns in that sheet look like listing data. Open Review columns to map them by hand."
        );
      }
    } else {
      grid = sheet.buildGrid(storedHeaderRow);
      // A mapping saved before a field existed can never contain it, so the
      // capability would stay dormant forever. Fill in only those newly
      // available fields, only on headers the user hasn't already assigned.
      const additions = backfillNewFields(columnMap, grid.headers, grid.records);
      if (Object.keys(additions).length > 0) {
        columnMap = { ...columnMap, ...additions };
        mapChanged = true;
      }
    }

    const outcome = await importRows(admin, {
      tenantId: landlord.tenant_id,
      landlordId: landlord.id,
      grid,
      columnMap,
      keyColumns,
    });

    await admin
      .from("landlord_sheet_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_seen: outcome.rows_seen,
        rows_created: outcome.rows_created,
        rows_updated: outcome.rows_updated,
        rows_skipped: outcome.rows_skipped,
        notes: [...readNotes, ...outcome.notes],
      })
      .eq("id", run.id);

    await admin
      .from("landlords")
      .update({
        spreadsheet_last_status: "success",
        spreadsheet_last_error: null,
        spreadsheet_last_row_count: outcome.rows_created + outcome.rows_updated,
        spreadsheet_header_row: grid.headerRow,
        // Written back only when we detected or extended it — never clobbers an
        // assignment the user confirmed.
        ...(mapChanged ? { spreadsheet_column_map: columnMap } : {}),
        // Only when the AI proposed an identity and the landlord had none.
        ...(keyColumnsChanged ? { spreadsheet_key_columns: keyColumns } : {}),
      })
      .eq("id", landlord.id);

    return {
      ok: true,
      rows_seen: outcome.rows_seen,
      rows_created: outcome.rows_created,
      rows_updated: outcome.rows_updated,
      rows_skipped: outcome.rows_skipped,
      auto_mapped: mapChanged,
    };
  } catch (err) {
    const message =
      err instanceof FeedSourceError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error while reading the spreadsheet.";
    return fail(message);
  }
}

/** Sheets are re-read daily, matching the SpareRoom scraper's cadence. */
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDue(lastRunAt: string | null, now = Date.now()): boolean {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  if (Number.isNaN(last)) return true;
  // Small tolerance so a job firing a few minutes early still counts the sheet
  // as due rather than deferring it a whole day.
  return now - last >= DAY_MS - 5 * 60 * 1000;
}
