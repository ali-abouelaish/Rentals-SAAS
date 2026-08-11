"use server";

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FIELD_BY_KEY } from "../domain/fields";
import type { ColumnMap } from "../domain/types";
import { DriveError, DriveImageClient, isCommunalFolder, parseDriveFolderId } from "../lib/drive-images";
import { FeedSourceError } from "../lib/fetch-source";
import { serviceAccountStatus } from "../lib/google-auth";
import { loadGrid } from "../lib/run-feed";

/**
 * Walks the photo pipeline end to end and reports what happened at each step.
 *
 * Photo import spans four systems — the sheet, the Sheets API, the column
 * mapping and Drive — and a break anywhere shows up identically as "no
 * pictures". This exists so the failing step names itself instead of having to
 * be inferred.
 */

export type DiagnosticStep = {
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  /** What to do about it, when there is something to do. */
  fix?: string;
};

export type SheetDiagnostics = { steps: DiagnosticStep[] };

/** Rows sampled for the per-room match report. */
const SAMPLE_ROWS = 5;

export async function diagnoseLandlordSheet(
  landlordId: string
): Promise<{ ok: true; report: SheetDiagnostics } | { ok: false; error: string }> {
  try {
    await requireRole([...ADMIN_ROLES]);
  } catch {
    return { ok: false, error: "Not permitted." };
  }

  const supabase = createSupabaseServerClient();
  const { data: landlord, error } = await supabase
    .from("landlords")
    .select("id, name, spreadsheet_url, spreadsheet_header_row, spreadsheet_column_map")
    .eq("id", landlordId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!landlord) return { ok: false, error: "Landlord not found." };
  if (!landlord.spreadsheet_url) return { ok: false, error: "This landlord has no spreadsheet link." };

  const steps: DiagnosticStep[] = [];
  const add = (step: DiagnosticStep) => steps.push(step);

  // ── 1. Credentials ─────────────────────────────────────────
  const credentials = serviceAccountStatus();
  const email = credentials.ok ? credentials.account.client_email : null;
  add(
    credentials.ok
      ? {
          label: "Google service account",
          status: "ok",
          detail: `${credentials.account.client_email} (from ${credentials.source})`,
        }
      : {
          label: "Google service account",
          status: "fail",
          detail: credentials.reason,
          fix: credentials.fix,
        }
  );

  // ── 2. Reading the sheet ───────────────────────────────────
  let grid;
  try {
    const loaded = await loadGrid(
      landlord.spreadsheet_url,
      landlord.spreadsheet_header_row ?? undefined
    );
    grid = loaded.grid;

    if (loaded.via === "sheets-api") {
      add({
        label: "Sheet read path",
        status: "ok",
        detail: `Google Sheets API — hyperlinks are readable. Tab: ${grid.sheetName ?? "(unnamed)"}.`,
      });
    } else {
      add({
        label: "Sheet read path",
        status: "warn",
        detail: loaded.apiError
          ? `CSV export — the Sheets API was tried first and failed: ${loaded.apiError}`
          : "CSV export (no service account, or not a Google Sheet).",
        fix: "On this path Google strips the link behind a hyperlinked cell, so a cell reading “Pictures” arrives as that word and no folder can be opened.",
      });
    }
  } catch (err) {
    add({
      label: "Sheet read path",
      status: "fail",
      detail: err instanceof FeedSourceError ? err.message : "Could not read the spreadsheet.",
    });
    return { ok: true, report: { steps } };
  }

  add({
    label: "Sheet contents",
    status: grid.records.length > 0 ? "ok" : "fail",
    detail: `${grid.records.length} data rows, ${grid.headers.length} columns, headers on row ${grid.headerRow + 1}.`,
  });

  // ── 3. Is a folder column mapped? ──────────────────────────
  const columnMap = (landlord.spreadsheet_column_map ?? {}) as ColumnMap;
  const folderHeader = Object.entries(columnMap).find(
    ([, field]) => field === "drive_folder_url"
  )?.[0];

  if (!folderHeader) {
    const candidate = grid.headers.find((h) =>
      grid.records.some((r) => /drive\.google\.com/i.test(r[h] ?? ""))
    );
    add({
      label: "Drive folder column",
      status: "fail",
      detail: "No column is mapped to “Google Drive photo folder”.",
      fix: candidate
        ? `Column “${candidate}” contains Drive links — map it in Review columns.`
        : "Open Review columns and map whichever column holds the Drive folder link.",
    });
    return { ok: true, report: { steps } };
  }

  add({ label: "Drive folder column", status: "ok", detail: `Mapped from “${folderHeader}”.` });

  // ── 4. Does that column resolve to a URL? ──────────────────
  const firstIndex = grid.records.findIndex((r) => (r[folderHeader] ?? "").trim());
  if (firstIndex === -1) {
    add({
      label: "Folder link value",
      status: "fail",
      detail: `Every cell in “${folderHeader}” is empty.`,
    });
    return { ok: true, report: { steps } };
  }

  const cellText = grid.records[firstIndex][folderHeader] ?? "";
  const cellLink = grid.links?.[firstIndex]?.[folderHeader];
  const resolved = cellLink ?? (/^https?:\/\//i.test(cellText) ? cellText : null);

  if (!resolved) {
    add({
      label: "Folder link value",
      status: "fail",
      detail: `Cell reads “${cellText.slice(0, 60)}” and carries no readable hyperlink.`,
      fix: email
        ? "The sheet was read over CSV export, which drops the link. See the read-path step above."
        : "Either configure a service account so hyperlinks can be read, or put the full https:// address in the cell as plain text.",
    });
    return { ok: true, report: { steps } };
  }

  add({
    label: "Folder link value",
    status: "ok",
    detail: cellLink
      ? `Cell reads “${cellText.slice(0, 40)}”, hyperlink resolves to ${resolved.slice(0, 80)}`
      : resolved.slice(0, 100),
  });

  // ── 5. Can we open the folder? ─────────────────────────────
  const folderId = parseDriveFolderId(resolved);
  if (!folderId) {
    add({
      label: "Drive folder",
      status: "fail",
      detail: "That link is not a Google Drive folder.",
      fix: "Use the folder's Share link, which looks like https://drive.google.com/drive/folders/…",
    });
    return { ok: true, report: { steps } };
  }

  if (!DriveImageClient.isConfigured()) {
    add({ label: "Drive folder", status: "fail", detail: "No service account — cannot list the folder." });
    return { ok: true, report: { steps } };
  }

  const client = new DriveImageClient();
  let folder;
  try {
    folder = await client.listFolder(folderId);
  } catch (err) {
    add({
      label: "Drive folder",
      status: "fail",
      detail: err instanceof DriveError ? err.message : "Drive request failed.",
      fix: `Share the folder with ${email ?? "the service account"} as Viewer, or set it to “Anyone with the link”. Also check the Drive API is enabled on the Google project.`,
    });
    return { ok: true, report: { steps } };
  }

  const subfolders = folder?.subfolders ?? [];
  const communal = subfolders.filter((f) => isCommunalFolder(f.name));
  const roomFolders = subfolders.filter((f) => !isCommunalFolder(f.name));

  add({
    label: "Drive folder",
    status: subfolders.length > 0 || (folder?.images.length ?? 0) > 0 ? "ok" : "fail",
    detail:
      `${folder?.images.length ?? 0} loose images, ${roomFolders.length} room subfolder(s)` +
      `${roomFolders.length > 0 ? ` (${roomFolders.slice(0, 8).map((f) => f.name).join(", ")})` : ""}` +
      `, ${communal.length} communal (${communal.slice(0, 5).map((f) => f.name).join(", ") || "none"}).`,
    fix:
      subfolders.length === 0 && (folder?.images.length ?? 0) === 0
        ? "The folder is empty, or contains only non-image files. Note we read image files only (JPG/PNG/WebP/GIF/HEIC)."
        : undefined,
  });

  // ── 6. Per-row room matching ───────────────────────────────
  const roomHeader = Object.entries(columnMap).find(([, f]) => f === "room_label")?.[0];
  const typeHeader = Object.entries(columnMap).find(([, f]) => f === "property_type")?.[0];
  const titleHeader = Object.entries(columnMap).find(([, f]) => f === "title")?.[0];

  const lines: string[] = [];
  let matchedAny = false;
  for (const record of grid.records.slice(0, SAMPLE_ROWS)) {
    const label =
      (roomHeader && record[roomHeader]) ||
      (typeHeader && record[typeHeader]) ||
      (titleHeader && record[titleHeader]) ||
      "";
    try {
      const { urls, matchedFolder } = await client.imagesForRoom(folderId, label || null);
      if (matchedFolder) matchedAny = true;
      lines.push(
        `“${label || "(no room label)"}” → ${matchedFolder ? `folder “${matchedFolder}”` : "no room folder matched"}, ${urls.length} photo(s)`
      );
    } catch {
      lines.push(`“${label}” → Drive lookup failed`);
    }
  }

  add({
    label: `Room matching (first ${Math.min(SAMPLE_ROWS, grid.records.length)} rows)`,
    status: matchedAny ? "ok" : "warn",
    detail: lines.join("\n"),
    fix: matchedAny
      ? undefined
      : `No row matched a room subfolder, so rows get communal photos only. Map a “Room name / number” column${roomHeader ? "" : " (none is mapped)"} whose values look like the subfolder names — currently ${roomFolders.slice(0, 5).map((f) => `“${f.name}”`).join(", ") || "there are no room subfolders"}.`,
  });

  // Only meaningful once we know a folder is reachable.
  if (!FIELD_BY_KEY.drive_folder_url) {
    add({ label: "Internal", status: "warn", detail: "Drive folder field missing from the catalogue." });
  }

  return { ok: true, report: { steps } };
}
