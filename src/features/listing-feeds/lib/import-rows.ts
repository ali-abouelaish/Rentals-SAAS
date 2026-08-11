/**
 * Applies a landlord's confirmed column mapping to a parsed sheet and upserts
 * the result into `scraped_listings`.
 *
 * Row identity: every imported row gets an `external_ref` that is stable across
 * reads, so re-reading the same sheet updates listings instead of duplicating
 * them. Preference order is the sheet's own reference column, then the listing
 * URL, then a content hash — the last is a fallback and will treat an edited
 * title as a new listing, which is why the mapping screen recommends mapping a
 * reference column.
 *
 * Every row belongs to the landlord whose spreadsheet it came from; there is no
 * per-row landlord lookup, because the sheet *is* that landlord's.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FIELD_BY_KEY, VIRTUAL_FIELD_KEYS } from "../domain/fields";
import type { ColumnMap, SheetGrid } from "../domain/types";
import { coerceValue } from "./field-map";
import { DriveError, DriveImageClient, parseDriveFolderId } from "./drive-images";

const UPSERT_CHUNK = 400;
const MAX_NOTES = 50;
/** Guard on the existing-refs prefetch used to classify created vs updated. */
const MAX_EXISTING_REFS = 50_000;

export type ImportOutcome = {
  rows_seen: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  /** Skipped-row reasons and other per-read warnings, for the history panel. */
  notes: string[];
};

export type MappedRow = {
  external_ref: string;
  payload: Record<string, string | number | null>;
  raw: Record<string, string>;
};

/** Cap on distinct Drive folders touched in one import. */
const MAX_DRIVE_FOLDERS = 50;

function contentHash(parts: (string | number | null)[]): string {
  return createHash("sha1").update(parts.map((p) => String(p ?? "")).join("|")).digest("hex").slice(0, 32);
}

/** Beyond this, a composite key is hashed rather than stored verbatim. */
const MAX_READABLE_KEY = 200;

/**
 * Build a row key from the user's chosen columns. Values are lowercased and
 * whitespace-collapsed so trivial edits ("12 Birchfield Rd " → "12 birchfield
 * rd") don't orphan the row and create a duplicate.
 *
 * Kept human-readable when short — being able to read `external_ref` in the DB
 * is worth a lot when diagnosing a sheet — and hashed past that so a long key
 * can never be truncated into a collision with a different row.
 *
 * Returns null when every chosen column is empty for this row, so the caller
 * falls through to the default identity chain.
 */
function compositeKey(record: Record<string, string>, keyColumns: string[]): string | null {
  const parts = keyColumns.map((header) =>
    (record[header] ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  );
  if (parts.every((part) => !part)) return null;

  const joined = parts.join("|");
  if (joined.length <= MAX_READABLE_KEY) return joined;
  return `k:${createHash("sha1").update(joined).digest("hex").slice(0, 32)}`;
}

/**
 * Turn sheet records into listing payloads. Pure — no DB access — so the
 * preview screen can show exactly what an import would write.
 */
export function mapRows(
  grid: SheetGrid,
  columnMap: ColumnMap,
  keyColumns: string[] = []
): { rows: MappedRow[]; notes: string[] } {
  const rows: MappedRow[] = [];
  const notes: string[] = [];
  const seenRefs = new Set<string>();

  // Only keep mappings whose header actually exists in this pull — a column
  // renamed upstream should be reported, not silently dropped.
  const activePairs = Object.entries(columnMap).filter(([header]) => grid.headers.includes(header));
  const missingHeaders = Object.keys(columnMap).filter((header) => !grid.headers.includes(header));
  for (const header of missingHeaders) {
    notes.push(`Column "${header}" is mapped but no longer exists in the sheet.`);
  }

  // A missing identity column would silently change every row's key and
  // re-import the whole sheet as new listings, so drop it and say so loudly.
  const activeKeyColumns = keyColumns.filter((header) => grid.headers.includes(header));
  for (const header of keyColumns.filter((h) => !grid.headers.includes(h))) {
    notes.push(
      `Row-identity column "${header}" no longer exists in the sheet — rows may be re-imported as new listings until you fix it.`
    );
  }

  // Link columns whose text wasn't a URL and had no hyperlink behind it —
  // the signature of a CSV export having discarded the cell's target.
  const lostLinkHeaders = new Set<string>();

  grid.records.forEach((record, index) => {
    const sheetRowNumber = grid.headerRow + 2 + index; // 1-based, past the header
    const rowLinks = grid.links?.[index] ?? {};
    const payload: Record<string, string | number | null> = {};
    let externalRefFromSheet: string | null = null;

    for (const [header, fieldKey] of activePairs) {
      const raw = record[header] ?? "";
      if (fieldKey === "external_ref") {
        const value = raw.trim();
        if (value) externalRefFromSheet = value;
        continue;
      }
      if (VIRTUAL_FIELD_KEYS.has(fieldKey) || !FIELD_BY_KEY[fieldKey]) continue;

      const coerced = coerceValue(fieldKey, raw, rowLinks[header]);
      if (coerced !== null) {
        payload[fieldKey] = coerced;
      } else if (FIELD_BY_KEY[fieldKey]?.type === "url" && raw.trim()) {
        // The cell had content but produced no usable link.
        lostLinkHeaders.add(header);
      }
    }

    // A row with nothing identifying is a stray note or a formatting artefact.
    const hasIdentity =
      payload.title || payload.location || payload.url || payload.price !== undefined;
    if (!hasIdentity) {
      if (notes.length < MAX_NOTES) {
        notes.push(`Row ${sheetRowNumber}: no title, address, URL or price — skipped.`);
      }
      return;
    }

    // Identity precedence: the columns the user explicitly nominated, then a
    // mapped reference column, then the listing URL, then a fingerprint of the
    // identifying fields. Earlier options survive edits to the sheet better.
    const externalRef =
      (activeKeyColumns.length > 0 ? compositeKey(record, activeKeyColumns) : null) ??
      externalRefFromSheet ??
      (typeof payload.url === "string" && payload.url ? payload.url : null) ??
      contentHash([payload.title ?? null, payload.location ?? null, payload.price ?? null]);

    if (seenRefs.has(externalRef)) {
      if (notes.length < MAX_NOTES) {
        notes.push(
          activeKeyColumns.length > 0
            ? `Row ${sheetRowNumber}: same ${activeKeyColumns.join(" + ")} as an earlier row (${externalRef.slice(0, 60)}) — skipped. Add another column to the row identity to tell them apart.`
            : `Row ${sheetRowNumber}: duplicate of an earlier row (${externalRef.slice(0, 40)}) — skipped.`
        );
      }
      return;
    }
    seenRefs.add(externalRef);

    rows.push({ external_ref: externalRef, payload, raw: record });
  });

  // This is the single most confusing failure mode of the whole importer, so
  // name the cause and the two fixes rather than leaving the column empty.
  for (const header of lostLinkHeaders) {
    notes.push(
      `Column "${header}" holds text, not a web address — its cells are probably hyperlinks (e.g. the word “Pictures” linking to a folder). Google's CSV export drops the link behind such cells. Fix by configuring a Google service account on the server so the sheet is read through the Sheets API, or by putting the full https:// address in the cell as plain text.`
    );
  }

  return { rows, notes };
}

/**
 * Fill each row's photo columns from its Google Drive folder.
 *
 * Mutates `rows` in place and appends diagnostics to `notes`. Photo failures are
 * never fatal: a folder we cannot open, or a missing service account, leaves the
 * listings intact without pictures and says so, rather than failing the import.
 *
 * Column shape deliberately matches what the SpareRoom scraper writes, so both
 * sources are interchangeable downstream:
 *   first_photo_url — the first URL
 *   all_photos      — comma-joined
 *   photos          — JSON array
 *   photo_count     — length
 */
async function attachDriveImages(rows: MappedRow[], notes: string[]): Promise<void> {
  const withFolders = rows.filter((row) => typeof row.payload.drive_folder_url === "string");

  if (withFolders.length === 0) {
    // Returning quietly here is how "no photos" became undiagnosable: no
    // images, no error, nothing in the logs. Look at the raw rows and say
    // which of the two possible reasons it actually is.
    const looksLikeDrive = rows.some((row) =>
      Object.values(row.raw).some((value) => /drive\.google\.com/i.test(value ?? ""))
    );
    if (looksLikeDrive) {
      notes.push(
        "This sheet contains Google Drive links, but no column is mapped to “Google Drive photo folder” — open Review columns and map it to import room photos."
      );
    } else if (rows.length > 0) {
      notes.push(
        "No photos imported: no column is mapped to “Google Drive photo folder”, and no Drive links were found in the sheet."
      );
    }
    return;
  }

  if (!DriveImageClient.isConfigured()) {
    notes.push(DriveImageClient.missingCredentialsMessage());
    return;
  }

  const client = new DriveImageClient();
  const seenFolders = new Set<string>();
  // One message per bad folder, not one per row that references it.
  const failedFolders = new Set<string>();
  const unmatchedRooms: string[] = [];
  let rowsWithPhotos = 0;

  for (const row of withFolders) {
    const rawUrl = String(row.payload.drive_folder_url ?? "");
    const folderId = parseDriveFolderId(rawUrl);
    if (!folderId) {
      if (!failedFolders.has(rawUrl)) {
        failedFolders.add(rawUrl);
        notes.push(`"${rawUrl.slice(0, 80)}" is not a Google Drive folder link — photos skipped.`);
      }
      continue;
    }

    if (!seenFolders.has(folderId)) {
      if (seenFolders.size >= MAX_DRIVE_FOLDERS) {
        notes.push(
          `More than ${MAX_DRIVE_FOLDERS} different Drive folders in one sheet — photos beyond that were skipped.`
        );
        break;
      }
      seenFolders.add(folderId);
    }
    if (failedFolders.has(folderId)) continue;

    const roomLabel =
      (typeof row.payload.room_label === "string" && row.payload.room_label) ||
      (typeof row.payload.property_type === "string" && row.payload.property_type) ||
      (typeof row.payload.title === "string" && row.payload.title) ||
      null;

    try {
      const { urls, matchedFolder } = await client.imagesForRoom(folderId, roomLabel);
      if (urls.length === 0) continue;
      rowsWithPhotos += 1;

      row.payload.first_photo_url = urls[0];
      row.payload.all_photos = urls.join(", ");
      row.payload.photos = JSON.stringify(urls);
      row.payload.photo_count = urls.length;
      row.payload.drive_room_folder = matchedFolder;

      // Worth reporting: the row got only communal photos because its room
      // could not be located in the folder.
      if (roomLabel && !matchedFolder) unmatchedRooms.push(roomLabel);
    } catch (err) {
      failedFolders.add(folderId);
      const message = err instanceof DriveError ? err.message : "Google Drive request failed.";
      if (notes.length < MAX_NOTES) notes.push(message);
    }
  }

  // The folder was mapped and readable but yielded nothing — almost always an
  // empty folder or one holding non-image files (PDFs, Google Docs).
  if (rowsWithPhotos === 0 && failedFolders.size === 0) {
    notes.push(
      `Read ${seenFolders.size} Drive folder${seenFolders.size === 1 ? "" : "s"} but found no images in ${seenFolders.size === 1 ? "it" : "them"}. Check the folder contains image files (JPG/PNG) rather than only subfolders of other file types.`
    );
  }

  if (unmatchedRooms.length > 0) {
    const unique = [...new Set(unmatchedRooms)];
    const shown = unique.slice(0, 8).join(", ");
    const suffix = unique.length > 8 ? ` (+${unique.length - 8} more)` : "";
    let hint = "";
    // Name the folders that *were* available, so the mismatch is obvious.
    const firstFolder = [...seenFolders][0];
    if (firstFolder) {
      try {
        const available = await client.roomFolderNames(firstFolder);
        if (available.length > 0) hint = ` Room subfolders found: ${available.slice(0, 8).join(", ")}.`;
      } catch {
        // Diagnostics only — a failure here must not change the import outcome.
      }
    }
    notes.push(
      `No Drive subfolder matched these rooms: ${shown}${suffix} — they got the communal photos only.${hint}`
    );
  }
}

/**
 * Write mapped rows for one landlord's spreadsheet. Uses the admin client
 * (RLS-bypassing) because scheduled reads have no user session; every row is
 * explicitly stamped with the landlord's `tenant_id` and `landlord_id`.
 */
export async function importRows(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    landlordId: string;
    grid: SheetGrid;
    columnMap: ColumnMap;
    keyColumns?: string[];
  }
): Promise<ImportOutcome> {
  const { tenantId, landlordId, grid, columnMap, keyColumns = [] } = opts;

  const { rows, notes } = mapRows(grid, columnMap, keyColumns);
  const allNotes = [...notes];

  // Photos come from Drive after mapping, so a row's room label (which the
  // mapping produces) is available to match against the folder's subfolders.
  await attachDriveImages(rows, allNotes);

  // Which refs already exist decides created vs updated — upsert cannot tell us.
  // Scoped to spreadsheet rows so the landlord's SpareRoom listings (which have
  // a null external_ref) are never counted or touched.
  const { data: existingRows, error: existingErr } = await supabase
    .from("scraped_listings")
    .select("external_ref")
    .eq("landlord_id", landlordId)
    .eq("source", "spreadsheet")
    .range(0, MAX_EXISTING_REFS - 1);
  if (existingErr) throw new Error(existingErr.message);
  const existing = new Set((existingRows ?? []).map((r) => r.external_ref as string));

  const now = new Date().toISOString();

  const payloads = rows.map((row) => ({
    tenant_id: tenantId,
    landlord_id: landlordId,
    external_ref: row.external_ref,
    source: "spreadsheet",
    last_seen_at: now,
    updated_at: now,
    raw_row: row.raw,
    ...row.payload,
  }));

  let created = 0;
  let updated = 0;
  for (const payload of payloads) {
    if (existing.has(payload.external_ref)) updated += 1;
    else created += 1;
  }

  for (let i = 0; i < payloads.length; i += UPSERT_CHUNK) {
    const chunk = payloads.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase
      .from("scraped_listings")
      .upsert(chunk, { onConflict: "landlord_id,external_ref" });
    if (error) throw new Error(error.message);
  }

  return {
    rows_seen: grid.records.length,
    rows_created: created,
    rows_updated: updated,
    rows_skipped: grid.records.length - rows.length,
    notes: allNotes.slice(0, MAX_NOTES),
  };
}
