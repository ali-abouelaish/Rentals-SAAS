import {
  BILLS_OPTIONS,
  COUPLES_OPTIONS,
  FURNISHING_OPTIONS,
  photoLines,
  type ManualListingValues,
} from "./schemas";

/** Blank → null, so an emptied field clears the column instead of storing "". */
function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function poundsOrNull(value: string): number | null {
  const cleaned = value.replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * The `scraped_listings` columns a manual listing owns. Photo columns use the
 * same shapes the spreadsheet importer writes (import-rows.ts), so the details
 * drawer, the public API and the map read them without special cases.
 *
 * Coordinates, provenance and timestamps are set by the server action, not here.
 */
export function manualListingToRow(values: ManualListingValues) {
  const photos = photoLines(values.photo_urls);
  return {
    title: values.title.trim(),
    location: textOrNull(values.location),
    price: poundsOrNull(values.price),
    deposit: poundsOrNull(values.deposit),
    available_date: textOrNull(values.available_date),
    min_term: textOrNull(values.min_term),
    property_type: textOrNull(values.property_type),
    room_count: values.room_count.trim() === "" ? null : Number(values.room_count),
    bills_included: textOrNull(values.bills_included),
    furnishings: textOrNull(values.furnishings),
    couples_ok: textOrNull(values.couples_ok),
    url: textOrNull(values.url),
    description: textOrNull(values.description),
    first_photo_url: photos[0] ?? null,
    all_photos: photos.length > 0 ? photos.join(", ") : null,
    photos: photos.length > 0 ? JSON.stringify(photos) : null,
    photo_count: photos.length,
  };
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Only values the select offers; anything else would fail the enum and block saving. */
function option<T extends string>(value: unknown, options: readonly T[]): "" | T {
  const s = str(value);
  return (options as readonly string[]).includes(s) ? (s as T) : "";
}

/** The photo URLs held on a row, preferring the JSON array over the comma list. */
function rowPhotos(row: Record<string, unknown>): string[] {
  const raw = row.photos;
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // fall through to the comma list
    }
  }
  return str(row.all_photos)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A stored manual listing back into the dialog's form values, for editing. */
export function rowToManualListingValues(row: Record<string, unknown>): ManualListingValues {
  return {
    title: str(row.title),
    location: str(row.location),
    price: str(row.price),
    deposit: str(row.deposit),
    // date columns come back as YYYY-MM-DD, which is what <input type="date"> wants
    available_date: str(row.available_date).slice(0, 10),
    min_term: str(row.min_term),
    property_type: str(row.property_type),
    room_count: str(row.room_count),
    bills_included: option(row.bills_included, BILLS_OPTIONS),
    furnishings: option(row.furnishings, FURNISHING_OPTIONS),
    couples_ok: option(row.couples_ok, COUPLES_OPTIONS),
    url: str(row.url),
    photo_urls: rowPhotos(row).join("\n"),
    description: str(row.description),
  };
}
