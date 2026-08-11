/**
 * Turns raw spreadsheet bytes into a `SheetGrid`: a rectangular string grid
 * plus the row we believe is the header and the records below it.
 *
 * Real agency spreadsheets rarely start with headers on row 1 — they open with
 * a title, a logo row, or a blank spacer. `detectHeaderRow` finds the real one
 * so the user usually has nothing to correct.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { LISTING_FIELDS, normaliseHeader } from "../domain/fields";
import type { SheetGrid } from "../domain/types";
import { FeedSourceError } from "./fetch-source";

/** How far down the sheet we look for a header row. */
const HEADER_SCAN_ROWS = 15;
/** Cap on data rows carried into memory from one pull. */
const MAX_ROWS = 20_000;

/** Every synonym across every field, for header-likeness scoring. */
const ALL_SYNONYMS = new Set(
  LISTING_FIELDS.flatMap((f) => f.synonyms.map(normaliseHeader))
);

function looksNumeric(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[£$€]?\s*-?[\d,]+(\.\d+)?\s*(pcm|pw|pm)?$/i.test(trimmed);
}

function looksLikeDate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/.test(trimmed);
}

/**
 * Score a row on how much it reads like a header: mostly short, non-numeric
 * text, ideally using words we recognise as listing fields.
 */
function scoreHeaderRow(row: string[]): number {
  const cells = row.map((c) => (c ?? "").trim());
  const filled = cells.filter(Boolean);
  if (filled.length < 2) return -1;

  let score = filled.length * 2;

  for (const cell of filled) {
    if (looksNumeric(cell) || looksLikeDate(cell)) {
      // Data, not a label.
      score -= 4;
      continue;
    }
    if (cell.length > 60) {
      // A prose sentence — almost certainly a note row.
      score -= 3;
      continue;
    }
    const key = normaliseHeader(cell);
    if (ALL_SYNONYMS.has(key)) score += 6;
    else if (key.split(" ").length <= 4) score += 1;
  }

  // A header row is usually densely filled; sparse rows are titles or spacers.
  const density = filled.length / Math.max(cells.length, 1);
  score += Math.round(density * 6);

  return score;
}

/** Best-guess zero-based header row index. Falls back to the first filled row. */
export function detectHeaderRow(rows: string[][]): number {
  let bestIndex = -1;
  let bestScore = -Infinity;

  const limit = Math.min(rows.length, HEADER_SCAN_ROWS);
  for (let i = 0; i < limit; i += 1) {
    const score = scoreHeaderRow(rows[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    const firstFilled = rows.findIndex((r) => r.some((c) => (c ?? "").trim()));
    return firstFilled === -1 ? 0 : firstFilled;
  }
  return bestIndex;
}

/**
 * Make header labels safe to use as record keys: blanks become positional
 * names, duplicates get a numeric suffix. Trailing empty columns are dropped.
 *
 * Exported so the AI mapper can name columns identically to the grid — the
 * `ColumnMap` keys it produces must match `grid.headers` exactly.
 */
export function normaliseHeaderRow(row: string[]): string[] {
  // Excel pads rows with empties; trim the tail before naming columns.
  let end = row.length;
  while (end > 0 && !(row[end - 1] ?? "").trim()) end -= 1;

  const seen = new Map<string, number>();
  const headers: string[] = [];

  for (let i = 0; i < end; i += 1) {
    const raw = (row[i] ?? "").trim().replace(/\s+/g, " ");
    let label = raw || `Column ${i + 1}`;
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    if (count > 0) label = `${label} (${count + 1})`;
    headers.push(label);
  }
  return headers;
}

function toGrid(
  rows: string[][],
  headerRowOverride?: number,
  /** Parallel grid of hyperlink targets, same indexing as `rows`. */
  linkRows?: (string | null)[][]
): SheetGrid {
  if (rows.length === 0) {
    throw new FeedSourceError("The sheet is empty — there are no rows to import.");
  }

  const headerRow =
    headerRowOverride !== undefined && headerRowOverride >= 0 && headerRowOverride < rows.length
      ? headerRowOverride
      : detectHeaderRow(rows);

  const headers = normaliseHeaderRow(rows[headerRow] ?? []);
  if (headers.length === 0) {
    throw new FeedSourceError(
      `Row ${headerRow + 1} has no column headings. Set the header row manually.`
    );
  }

  const records: Record<string, string>[] = [];
  const links: Record<string, string>[] = [];
  for (let r = headerRow + 1; r < rows.length && records.length < MAX_ROWS; r += 1) {
    const row = rows[r] ?? [];
    // Skip spacer rows so they don't become empty listings.
    if (!row.some((c) => (c ?? "").trim())) continue;

    const record: Record<string, string> = {};
    const link: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (row[i] ?? "").toString().trim();
      const target = linkRows?.[r]?.[i];
      if (target) link[header] = target;
    });
    records.push(record);
    links.push(link);
  }

  return { rows, headerRow, headers, records, links, sheetName: null };
}

function parseCsvBuffer(buffer: Buffer): string[][] {
  // Strip a UTF-8 BOM — Papa keeps it on the first header otherwise.
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    // Let Papa work out comma vs semicolon vs tab.
    delimiter: "",
  });

  return (result.data ?? []).map((row) =>
    Array.isArray(row) ? row.map((cell) => (cell ?? "").toString()) : []
  );
}

function parseXlsxBuffer(buffer: Buffer, sheetGid: string | null): { rows: string[][]; sheetName: string | null } {
  let workbook: XLSX.WorkBook;
  try {
    // cellDates keeps real dates as Date objects rather than Excel serials;
    // the raw:false formatter below then renders them as displayed strings.
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new FeedSourceError("That file could not be read as a spreadsheet. Check it is a valid .xlsx or .csv.");
  }

  const names = workbook.SheetNames;
  if (names.length === 0) throw new FeedSourceError("That workbook has no sheets.");

  // gid is a Google concept; for a downloaded workbook treat it as a tab index.
  const index = sheetGid !== null && /^\d+$/.test(sheetGid) ? Number(sheetGid) : 0;
  const name = names[index] ?? names[0];
  const sheet = workbook.Sheets[name];

  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    // Take the displayed text, so "£1,200" and "01/03/2026" arrive as written.
    raw: false,
    defval: "",
    blankrows: true,
  });

  return {
    rows: rows.map((row) => (Array.isArray(row) ? row.map((c) => (c ?? "").toString()) : [])),
    sheetName: name,
  };
}

/**
 * Parse fetched bytes into a raw rectangular grid of strings, without deciding
 * a header row. Exposed so a caller can fetch once, snapshot the raw rows (e.g.
 * for the AI mapper to pick the header row), then build the grid.
 */
export function rawRowsFromBuffer(
  buffer: Buffer,
  format: "csv" | "xlsx",
  sheetGid: string | null = null
): { rows: string[][]; sheetName: string | null } {
  if (format === "xlsx") return parseXlsxBuffer(buffer, sheetGid);
  return { rows: parseCsvBuffer(buffer), sheetName: null };
}

/** Parse fetched bytes into a grid. `headerRowOverride` is zero-based. */
export function parseSheetBuffer(
  buffer: Buffer,
  format: "csv" | "xlsx",
  opts: { headerRowOverride?: number; sheetGid?: string | null } = {}
): SheetGrid {
  const { rows, sheetName } = rawRowsFromBuffer(buffer, format, opts.sheetGid ?? null);
  return { ...toGrid(rows, opts.headerRowOverride), sheetName };
}

/**
 * Build a grid from rows already returned by the Sheets API, optionally with
 * the parallel hyperlink grid that only that path can supply.
 */
export function gridFromRows(
  rows: string[][],
  sheetName: string | null,
  headerRowOverride?: number,
  linkRows?: (string | null)[][]
): SheetGrid {
  return { ...toGrid(rows, headerRowOverride, linkRows), sheetName };
}
