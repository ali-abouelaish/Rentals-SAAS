/**
 * Where a `scraped_listings` row came from. Each source refreshes on its own
 * terms — the scraper and the sheet importer re-confirm rows daily, a manual row
 * is only touched when someone edits it — so the UI must never let them read
 * alike.
 *
 * `source` is free text in the database (no CHECK), and the column default is
 * 'spareroom', so anything unrecognised is treated as the scraper's.
 */
export type ListingSource = "spareroom" | "spreadsheet" | "manual";

export function listingSource(value: unknown): ListingSource {
  return value === "spreadsheet" || value === "manual" ? value : "spareroom";
}

/** Short label for tables: "SpareRoom", "Spreadsheet", "Manual". */
export function listingSourceLabel(value: unknown): string {
  const source = listingSource(value);
  if (source === "spreadsheet") return "Spreadsheet";
  if (source === "manual") return "Manual";
  return "SpareRoom";
}

/** Longer label for provenance: "SpareRoom scraper", "Spreadsheet import", "Added by hand". */
export function listingSourceDescription(value: unknown): string {
  const source = listingSource(value);
  if (source === "spreadsheet") return "Spreadsheet import";
  if (source === "manual") return "Added by hand";
  return "SpareRoom scraper";
}
