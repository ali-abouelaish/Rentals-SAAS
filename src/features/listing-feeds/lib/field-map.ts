/**
 * Auto-detection of the sheet-header → listing-field mapping, plus the value
 * normalisers that turn spreadsheet text into typed column values.
 *
 * Detection is deliberately conservative: it proposes, the user confirms on the
 * mapping screen, and the confirmed map is stored on the feed. A re-pull then
 * replays that stored map, so a column renamed upstream surfaces as a failed
 * row rather than being silently re-guessed onto the wrong field.
 */

import {
  FIELD_BY_KEY,
  LISTING_FIELDS,
  isAbsoluteUrl,
  normaliseHeader,
  type FieldType,
} from "../domain/fields";
import type { ColumnMap, MappingSuggestion } from "../domain/types";

/** Below this, a header is left unmapped rather than guessed. */
export const MIN_CONFIDENCE = 0.45;
/** At or above this, the mapping screen treats the guess as settled. */
export const AUTO_ACCEPT_CONFIDENCE = 0.8;

// ------------------------------------------------------------------
// Header similarity
// ------------------------------------------------------------------

function tokens(value: string): string[] {
  return normaliseHeader(value).split(" ").filter(Boolean);
}

/**
 * Spreadsheet headers abbreviate constantly — "Avail From", "Descr", "Prop
 * Type". Treat a token as matching when one side is a prefix of the other and
 * the prefix is at least 4 characters, which covers those without letting tiny
 * fragments ("id", "no") collide with unrelated words.
 */
const MIN_PREFIX_MATCH = 4;

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_PREFIX_MATCH && long.startsWith(short);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = [...new Set(a)];
  const setB = [...new Set(b)];

  // Greedy pairing: each token on either side is consumed at most once, so a
  // header repeating a token cannot inflate the score.
  const usedB = new Set<number>();
  let shared = 0;
  for (const tokenA of setA) {
    const hit = setB.findIndex((tokenB, i) => !usedB.has(i) && tokensMatch(tokenA, tokenB));
    if (hit !== -1) {
      usedB.add(hit);
      shared += 1;
    }
  }
  return shared / (setA.length + setB.length - shared);
}

/** How well one header matches one synonym, 0–1. */
function synonymScore(headerNorm: string, headerTokens: string[], synonym: string): number {
  const synNorm = normaliseHeader(synonym);
  if (!synNorm) return 0;
  if (headerNorm === synNorm) return 1;

  const synTokens = synonym.split(" ").filter(Boolean).map((t) => normaliseHeader(t));

  // Whole-synonym substring, e.g. "monthly rent pcm" contains "rent pcm".
  if (headerNorm.includes(synNorm)) {
    // The more of the header the synonym accounts for, the better the match.
    return 0.72 + 0.2 * (synNorm.length / headerNorm.length);
  }
  // Header shorter than the synonym — only credit it when the synonym *starts*
  // with the header ("deposit" → "deposit amount"). Matching anywhere in the
  // synonym would let a plain "Rent" column claim "room 1 rent".
  if (synNorm.startsWith(headerNorm)) {
    return 0.62 + 0.2 * (headerNorm.length / synNorm.length);
  }

  return jaccard(headerTokens, synTokens) * 0.7;
}

// ------------------------------------------------------------------
// Value-shape agreement
// ------------------------------------------------------------------

function shapeAgreement(type: FieldType, samples: string[]): number {
  const filled = samples.filter((s) => s && s.trim()).slice(0, 12);
  if (filled.length === 0) return 0;

  let hits = 0;
  for (const value of filled) {
    switch (type) {
      case "number":
      case "int":
        if (parseNumber(value) !== null) hits += 1;
        break;
      case "date":
        if (parseDate(value) !== null) hits += 1;
        break;
      case "url":
        // Display text of a hyperlinked cell is not a URL, so a link column can
        // legitimately look non-URL here; don't let that veto the match.
        hits += 1;
        break;
      case "text":
        hits += 1;
        break;
    }
  }
  return hits / filled.length;
}

// ------------------------------------------------------------------
// Detection
// ------------------------------------------------------------------

type Candidate = { header: string; field: string; score: number };

/**
 * Propose a mapping for every header. Each listing field is claimed at most
 * once — the highest-scoring header wins it, and the losers fall through to
 * their next-best field.
 */
export function autoDetectMapping(
  headers: string[],
  records: Record<string, string>[]
): MappingSuggestion[] {
  const samplesByHeader = new Map<string, string[]>();
  for (const header of headers) {
    const values: string[] = [];
    for (const record of records) {
      const value = (record[header] ?? "").trim();
      if (value) values.push(value);
      if (values.length >= 12) break;
    }
    samplesByHeader.set(header, values);
  }

  const candidates: Candidate[] = [];
  for (const header of headers) {
    const headerNorm = normaliseHeader(header);
    if (!headerNorm) continue;
    const headerTokens = tokens(header);
    const samples = samplesByHeader.get(header) ?? [];

    for (const field of LISTING_FIELDS) {
      let best = 0;
      for (const synonym of field.synonyms) {
        const score = synonymScore(headerNorm, headerTokens, synonym);
        if (score > best) best = score;
      }
      if (best <= 0) continue;

      // Values that contradict the field's type pull the guess down; values
      // that fit nudge it up. Text fields are unaffected.
      const agreement = shapeAgreement(field.type, samples);
      let score = best;
      if (field.type !== "text") {
        if (agreement < 0.3) score *= 0.45;
        else if (agreement > 0.8) score = Math.min(1, score * 1.1);
      }

      // Content-based disambiguation for fields that share synonyms — notably
      // the photo family, where only the values distinguish a Drive folder link
      // from a direct image URL.
      score *= field.valueBoost?.(samples) ?? 1;

      // Left uncapped on purpose: clamping here would flatten distinct scores
      // into ties and let field declaration order decide the winner. The value
      // is clamped to 0–1 only when reported as a confidence.
      candidates.push({ header, field: field.key, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const takenHeaders = new Set<string>();
  const takenFields = new Set<string>();
  const chosen = new Map<string, { field: string; score: number }>();

  for (const candidate of candidates) {
    if (candidate.score < MIN_CONFIDENCE) break;
    if (takenHeaders.has(candidate.header) || takenFields.has(candidate.field)) continue;
    takenHeaders.add(candidate.header);
    takenFields.add(candidate.field);
    chosen.set(candidate.header, { field: candidate.field, score: candidate.score });
  }

  return headers.map((header) => {
    const hit = chosen.get(header);
    return {
      header,
      field: hit?.field ?? null,
      confidence: hit ? Math.round(Math.min(hit.score, 1) * 100) / 100 : 0,
      samples: (samplesByHeader.get(header) ?? []).slice(0, 3),
    };
  });
}

/**
 * Fields that did not exist when older mappings were saved. A stored map from
 * before they shipped cannot contain them, and replaying it verbatim means the
 * capability silently never engages — which is exactly what happened with Drive
 * photos.
 *
 * Only these are backfilled. Backfilling *every* missing field would re-map
 * columns a user had deliberately set to "Do not import", since we don't record
 * that choice distinctly from "never considered".
 */
const BACKFILLABLE_FIELDS = ["drive_folder_url", "room_label"];

/** Backfill needs a clearly-correct guess, not a plausible one. */
const BACKFILL_CONFIDENCE = 0.75;

/**
 * Add newly-available fields to an existing confirmed mapping without touching
 * any assignment the user already has.
 *
 * Returns the additions only — empty when there is nothing to add — so callers
 * can tell whether the stored mapping needs persisting again.
 */
export function backfillNewFields(
  columnMap: ColumnMap,
  headers: string[],
  records: Record<string, string>[]
): ColumnMap {
  const mappedFields = new Set(Object.values(columnMap));
  const missing = BACKFILLABLE_FIELDS.filter((field) => !mappedFields.has(field));
  if (missing.length === 0) return {};

  const additions: ColumnMap = {};
  const suggestions = autoDetectMapping(headers, records);

  for (const suggestion of suggestions) {
    if (!suggestion.field) continue;
    // Never touch a header the user has already assigned.
    if (columnMap[suggestion.header] !== undefined) continue;
    if (!missing.includes(suggestion.field)) continue;
    if (suggestion.confidence < BACKFILL_CONFIDENCE) continue;
    // Two headers could both suggest the same new field; first wins.
    if (Object.values(additions).includes(suggestion.field)) continue;
    additions[suggestion.header] = suggestion.field;
  }

  return additions;
}

/** Collapse suggestions into the `column_map` shape stored on the feed. */
export function suggestionsToColumnMap(suggestions: MappingSuggestion[]): ColumnMap {
  const map: ColumnMap = {};
  for (const suggestion of suggestions) {
    if (suggestion.field) map[suggestion.header] = suggestion.field;
  }
  return map;
}

// ------------------------------------------------------------------
// Value normalisers
// ------------------------------------------------------------------

/**
 * "£1,200 pcm" → 1200. Returns null when there is no number to find, so the
 * importer can leave the column null rather than writing 0.
 */
export function parseNumber(raw: string): number | null {
  if (raw === null || raw === undefined) return null;
  let text = String(raw).trim();
  if (!text) return null;

  // Ranges like "£650 - £800": take the lower bound.
  const rangeMatch = /^([^-–—]+)[-–—](.+)$/.exec(text);
  if (rangeMatch && /\d/.test(rangeMatch[1])) text = rangeMatch[1];

  const negative = /^\(.*\)$/.test(text.trim());
  const cleaned = text
    .replace(/[()]/g, "")
    .replace(/[£$€,\s]/g, "")
    .replace(/(pcm|pppw|pppm|pw|pm|per\s*month|per\s*week|month|week)$/i, "")
    .trim();

  if (!cleaned || !/\d/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

export function parseInt10(raw: string): number | null {
  const value = parseNumber(raw);
  if (value === null) return null;
  return Math.trunc(value);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects impossible dates that JS would roll over (31 Feb → 3 Mar).
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Spreadsheet date text → ISO `YYYY-MM-DD`, or null.
 *
 * Ambiguous numeric dates are read as UK order (DD/MM/YYYY) — this is a UK
 * lettings product and that is what agency sheets use. ISO-looking values
 * (YYYY-MM-DD) are detected by their four-digit leading year and read as ISO.
 */
export function parseDate(raw: string): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  if (/^(now|asap|immediate(ly)?|available\s*now|vacant)$/.test(lower)) {
    return new Date().toISOString().slice(0, 10);
  }

  // ISO first: 2026-03-01 or 2026/03/01
  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (isoMatch) {
    return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY
  const ukMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(text);
  if (ukMatch) {
    const day = Number(ukMatch[1]);
    const month = Number(ukMatch[2]);
    let year = Number(ukMatch[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return iso(year, month, day);
  }

  // "1 March 2026", "1st Mar 26", "March 1 2026"
  const dmy = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?\s+(\d{2,4})$/i.exec(text);
  if (dmy) {
    const month = MONTHS[dmy[2].slice(0, 4).toLowerCase()] ?? MONTHS[dmy[2].slice(0, 3).toLowerCase()];
    let year = Number(dmy[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month) return iso(year, month, Number(dmy[1]));
  }
  const mdy = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/i.exec(text);
  if (mdy) {
    const month = MONTHS[mdy[1].slice(0, 4).toLowerCase()] ?? MONTHS[mdy[1].slice(0, 3).toLowerCase()];
    let year = Number(mdy[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month) return iso(year, month, Number(mdy[2]));
  }

  // Bare Excel serial (only reachable when a sheet exports unformatted).
  // 25569 = 1970-01-01; the lower bound skips small integers like "5".
  if (/^\d{4,6}(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 20000 && serial <= 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
  }

  return null;
}

const MAX_TEXT = 4000;

export function parseText(raw: string): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

/**
 * Coerce a cell for the field it is mapped to. Unknown fields yield null.
 *
 * `link` is the cell's real hyperlink target where one is available. It wins
 * over the cell text for `url` fields: a cell linked to a Drive folder but
 * displaying "Pictures" must import as the folder, not the word.
 */
export function coerceValue(
  fieldKey: string,
  raw: string,
  link?: string
): string | number | null {
  const field = FIELD_BY_KEY[fieldKey];
  if (!field) return null;
  switch (field.type) {
    case "number":
      return parseNumber(raw);
    case "int":
      return parseInt10(raw);
    case "date":
      return parseDate(raw);
    case "url":
      return parseUrl(raw, link);
    case "text":
    default:
      return parseText(raw);
  }
}

/**
 * Resolve a link cell. Prefers the hyperlink target, then the text if it is
 * itself a URL. Returns null for anything else rather than storing display text
 * — a non-URL in a link column becomes a relative href downstream and sends the
 * user to a nonsense route.
 */
export function parseUrl(raw: string, link?: string): string | null {
  if (link && isAbsoluteUrl(link)) return link.trim();
  const text = parseText(raw);
  if (text && isAbsoluteUrl(text)) return text;
  return null;
}
