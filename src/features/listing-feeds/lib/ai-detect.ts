/**
 * AI-driven "how do I scrape this sheet?" decision.
 *
 * Given a snapshot of the top rows of a spreadsheet, an LLM decides the three
 * things a synonym heuristic struggles with on messy real-world agency sheets:
 *   1. which row is the real header (sheets open with titles, logos, blank rows);
 *   2. which listing field each column maps to;
 *   3. which columns form a stable row identity for de-duplication across reads.
 *
 * It returns the same `MappingSuggestion[]` shape `autoDetectMapping` produces,
 * so it is a drop-in for the heuristic on both the first read and the review
 * dialog.
 *
 * This never throws and never blocks an import. With no `OPENAI_API_KEY`, or on
 * any API/parse failure, it returns null and the caller falls back to the
 * synonym/value-shape heuristics in `field-map.ts`.
 */

import OpenAI from "openai";
import { FIELD_BY_KEY, LISTING_FIELDS } from "../domain/fields";
import type { MappingSuggestion } from "../domain/types";
import { detectHeaderRow, normaliseHeaderRow } from "./parse-sheet";

export type AiScrapeDecision = {
  /** Zero-based index into the raw rows of the row holding the headers. */
  header_row: number;
  /** One entry per header column; `field` is null for unmapped columns. */
  suggestions: MappingSuggestion[];
  /** Header names combined to identify a row across reads (dedupe key). */
  key_columns: string[];
};

const MODEL = "gpt-4o-mini";
/** How much of the sheet the model sees: enough rows to spot the header and judge column contents. */
const SNAPSHOT_ROWS = 25;
const SNAPSHOT_COLS = 40;
const MAX_CELL = 80;
const REQUEST_TIMEOUT_MS = 30_000;
/** `key_columns` schema caps a stored identity at 5 columns. */
const MAX_KEY_COLUMNS = 5;

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL,
    });
  }
  return client;
}

function truncate(value: unknown, max: number): string {
  const text = (value ?? "").toString();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Compact catalogue of mappable fields for the model. */
function fieldCatalogue() {
  return LISTING_FIELDS.map((f) => ({ key: f.key, label: f.label, type: f.type, group: f.group }));
}

const SYSTEM_PROMPT = `You configure the importer for a UK residential lettings / house-share listings platform. The user gives you a JSON snapshot of the top rows of an agency spreadsheet and the catalogue of listing fields it can be imported into. Decide how to scrape it.

INPUT
- "rows": the first rows of the sheet as an array of arrays of cell strings. Row indices and column indices are both 0-based. This is a sample, not the whole sheet.
- "fields": the listing fields you may map columns onto. Each has "key" (use this verbatim), "label", "type" and "group". "type" tells you the expected value shape: number (rent/deposit/price, currency and "pcm" allowed), int, date (UK format, e.g. 01/03/2026), url (a web link or a Google Drive folder), text.
- "forced_header_row": if not null, the header row is fixed at this index — use it and do not choose your own.

DECIDE
1. header_row — the 0-based index of the row that holds the column headings. Agency sheets frequently start with a title row, a logo/blank row, a merged banner, or a spacer before the real header, so it is often not row 0. Use "forced_header_row" when it is given.
2. columns — for each column that clearly corresponds to exactly one listing field, output {index, field, confidence}. "index" is the 0-based column position. "field" is a key from the catalogue, used verbatim. "confidence" is 0..1. Judge from BOTH the header text and the sample values beneath it. Map a column only when reasonably confident; omit columns that match no field or are internal-only notes. Never map two columns to the same field — pick the single best column for each field.
3. key_columns — the 0-based indices of the columns that together uniquely and stably identify a row, for de-duplicating the same listing across daily re-reads. Strongly prefer a single explicit reference / ID / code column (the "external_ref" field) when one exists. Otherwise choose the smallest natural key, e.g. address plus room number. Prefer stable columns (IDs, addresses) over volatile ones (price, status, availability). Return [] when nothing is reliable. At most 5.

OUTPUT
Return STRICT JSON only, no prose and no code fences:
{"header_row": <int>, "columns": [{"index": <int>, "field": "<key>", "confidence": <0..1>}, ...], "key_columns": [<int>, ...]}`;

export async function aiDetectScrape(
  rawRows: string[][],
  opts: { forcedHeaderRow?: number } = {}
): Promise<AiScrapeDecision | null> {
  const openai = getClient();
  if (!openai) return null;
  if (!Array.isArray(rawRows) || rawRows.length === 0) return null;

  const snapshot = rawRows
    .slice(0, SNAPSHOT_ROWS)
    .map((row) => (Array.isArray(row) ? row.slice(0, SNAPSHOT_COLS).map((cell) => truncate(cell, MAX_CELL)) : []));

  const userPayload = {
    forced_header_row: opts.forcedHeaderRow ?? null,
    fields: fieldCatalogue(),
    rows: snapshot,
  };

  let content: string;
  try {
    const completion = await openai.chat.completions.create(
      {
        model: MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      },
      { timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 }
    );
    content = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.warn(
      "[listing-feeds] AI mapping failed, falling back to heuristic:",
      err instanceof Error ? err.message : err
    );
    return null;
  }

  if (!content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  // Header row: trust the forced value, then the model, then the heuristic. The
  // model can hallucinate an out-of-range index, so never take it on faith.
  let headerRow = opts.forcedHeaderRow !== undefined ? opts.forcedHeaderRow : Number(obj.header_row);
  if (!Number.isInteger(headerRow) || headerRow < 0 || headerRow >= rawRows.length) {
    headerRow = detectHeaderRow(rawRows);
  }

  const headers = normaliseHeaderRow(rawRows[headerRow] ?? []);
  if (headers.length === 0) return null;

  // Resolve the model's column picks (by index), one field per column, each
  // listing field claimed at most once — highest confidence wins ties.
  type Pick = { index: number; field: string; confidence: number };
  const rawCols = Array.isArray(obj.columns) ? obj.columns : [];
  const picks: Pick[] = [];
  for (const item of rawCols) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const index = Number(c.index);
    if (!Number.isInteger(index) || index < 0 || index >= headers.length) continue;
    const field = c.field === null || c.field === undefined ? null : String(c.field);
    if (!field || !(field in FIELD_BY_KEY)) continue;
    const confidence = Number(c.confidence);
    picks.push({
      index,
      field,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.7,
    });
  }
  picks.sort((a, b) => b.confidence - a.confidence);

  const chosen = new Map<number, { field: string; confidence: number }>();
  const takenFields = new Set<string>();
  for (const pick of picks) {
    if (chosen.has(pick.index) || takenFields.has(pick.field)) continue;
    chosen.set(pick.index, { field: pick.field, confidence: pick.confidence });
    takenFields.add(pick.field);
  }

  // Evidence values for the review UI: first few non-empty cells under a column.
  const sampleFor = (index: number): string[] => {
    const out: string[] = [];
    for (let r = headerRow + 1; r < rawRows.length && out.length < 3; r += 1) {
      const value = (rawRows[r]?.[index] ?? "").toString().trim();
      if (value) out.push(truncate(value, MAX_CELL));
    }
    return out;
  };

  const suggestions: MappingSuggestion[] = headers.map((header, index) => {
    const hit = chosen.get(index);
    return {
      header,
      field: hit?.field ?? null,
      confidence: hit ? Math.round(hit.confidence * 100) / 100 : 0,
      samples: sampleFor(index),
    };
  });

  // Key columns: the model returns column indices; accept a header name too in
  // case it answers with one. Keep only real, in-range, de-duplicated headers.
  const rawKeys = Array.isArray(obj.key_columns) ? obj.key_columns : [];
  const keyColumns: string[] = [];
  for (const raw of rawKeys) {
    let header: string | undefined;
    if (typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw))) {
      const index = Number(raw);
      if (index >= 0 && index < headers.length) header = headers[index];
    } else if (typeof raw === "string") {
      header = headers.find((h) => h === raw);
    }
    if (header && !keyColumns.includes(header)) keyColumns.push(header);
    if (keyColumns.length >= MAX_KEY_COLUMNS) break;
  }

  return { header_row: headerRow, suggestions, key_columns: keyColumns };
}
