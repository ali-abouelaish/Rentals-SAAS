/**
 * Pulls listing photos out of a Google Drive folder.
 *
 * The shape agencies actually use: one folder per property, containing a
 * subfolder per room ("Room 1", "Bedroom 2", "Loft Room") plus one or more
 * communal subfolders ("Kitchen", "Bathroom", "Communal Areas"). Images sitting
 * loose in the property folder are treated as property-wide.
 *
 * Each spreadsheet row is one room, so for every row we match its room label to
 * a subfolder and attach that room's photos first, then the communal ones. A
 * row whose room cannot be matched still gets the communal photos, so it is
 * never left with nothing.
 *
 * Unlike Sheets, Drive has no credential-free path — listing a folder requires
 * the API, so a service account must be configured (see `google-auth.ts`).
 */

import { DRIVE_SCOPE, googleJwt, hasServiceAccount, serviceAccountEmail } from "./google-auth";

/** Ceilings so one malformed folder cannot fan out into thousands of API calls. */
const MAX_SUBFOLDERS = 100;
const MAX_FILES_PER_FOLDER = 200;
const MAX_PHOTOS_PER_ROW = 40;

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveFile = { id: string; name: string };
export type DriveFolder = {
  id: string;
  /** Subfolders, in Drive's own order. */
  subfolders: DriveFile[];
  /** Image files directly inside this folder. */
  images: DriveFile[];
};

export type RoomImages = {
  urls: string[];
  /** Which subfolder supplied the room-specific photos, for diagnostics. */
  matchedFolder: string | null;
};

/**
 * Public, hot-linkable URL for a Drive image. Requires the folder to be shared
 * as "anyone with the link" — a folder shared only with the service account can
 * be *read* by the importer but its images will not render for end users.
 */
export function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/**
 * Extract a folder id from the forms people paste:
 *   /drive/folders/<id>            — the usual "share folder" link
 *   /drive/u/0/folders/<id>        — multi-account browsers
 *   /open?id=<id>                  — older share links
 *   /file/d/<id>                   — a file link; treated as a folder id and
 *                                    reported as not-a-folder if it isn't
 * Returns null when the URL is not a Drive link at all.
 */
export function parseDriveFolderId(raw: string): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    // Bare ids are common in spreadsheets — accept anything that looks like one.
    return /^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : null;
  }

  if (!/(^|\.)(drive|docs)\.google\.com$/i.test(url.hostname)) return null;

  const folders = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url.pathname);
  if (folders) return folders[1];

  const fileD = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url.pathname);
  if (fileD) return fileD[1];

  const idParam = url.searchParams.get("id");
  if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) return idParam;

  return null;
}

// ------------------------------------------------------------------
// Room-name matching
// ------------------------------------------------------------------

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COMMUNAL_WORDS = [
  "communal", "common", "shared", "share", "general", "misc", "other",
  "kitchen", "lounge", "living", "sitting", "dining", "bathroom", "shower",
  "toilet", "wc", "hall", "hallway", "landing", "stairs", "corridor",
  "exterior", "outside", "outdoor", "garden", "yard", "front", "back",
  "property", "house", "flat", "building", "communal areas", "amenities",
];

/**
 * Folders that are neither a room nor communal — archives and scratch folders
 * agencies leave lying around. Without this an "OLD" folder is treated as a
 * room and can win a fuzzy match, putting last year's photos on a live listing.
 */
const EXCLUDED_WORDS = [
  "old", "older", "archive", "archived", "unused", "backup", "backups",
  "bin", "trash", "deleted", "previous", "prev", "do not use", "dont use",
  "ignore", "temp", "tmp", "draft", "drafts",
];

export function isExcludedFolder(name: string): boolean {
  const norm = normalise(name);
  if (!norm) return true;
  const words = norm.split(" ");
  return EXCLUDED_WORDS.some((word) =>
    word.includes(" ") ? norm.includes(word) : words.includes(word)
  );
}

/** Does this subfolder hold photos that apply to every room in the property? */
export function isCommunalFolder(name: string): boolean {
  const norm = normalise(name);
  if (!norm) return false;
  const words = norm.split(" ");
  return COMMUNAL_WORDS.some((word) => {
    const parts = word.split(" ");
    if (parts.length > 1) return norm.includes(word);
    return words.includes(word);
  });
}

/** Trailing or standalone number in a label: "Room 4" → 4, "R2" → 2. */
function roomNumber(value: string): number | null {
  const norm = normalise(value);
  // Prefer a number that follows a room-ish word, so "Room 2" beats the "3" in
  // "3 bed house".
  const afterWord = /(?:room|bed|bedroom|rm|r|unit|flat)\s*(\d{1,3})\b/.exec(norm);
  if (afterWord) return Number(afterWord[1]);
  const solo = /\b(\d{1,3})\b/.exec(norm);
  return solo ? Number(solo[1]) : null;
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/** 0–1 similarity between a spreadsheet room label and a Drive subfolder name. */
export function roomFolderScore(roomLabel: string, folderName: string): number {
  const room = normalise(roomLabel);
  const folder = normalise(folderName);
  if (!room || !folder) return 0;
  if (room === folder) return 1;

  // Room codes are written inconsistently either side — "D1" in the sheet, "D 1"
  // as the folder, or vice versa. Compare with separators removed before
  // falling back to fuzzier signals.
  const roomCompact = room.replace(/ /g, "");
  const folderCompact = folder.replace(/ /g, "");
  if (roomCompact === folderCompact) return 0.98;

  const roomNum = roomNumber(roomLabel);
  const folderNum = roomNumber(folderName);

  // Room numbers are the strongest signal agencies actually use, and a
  // *mismatch* is decisive: "Room 2" must never match "Room 3", however similar
  // the rest of the text is.
  if (roomNum !== null && folderNum !== null) {
    if (roomNum !== folderNum) return 0;
    return 0.95;
  }

  if (folder.includes(room) || room.includes(folder)) return 0.85;

  const roomTokens = [...new Set(room.split(" ").filter(Boolean))];
  const folderTokens = [...new Set(folder.split(" ").filter(Boolean))];
  const used = new Set<number>();
  let shared = 0;
  for (const token of roomTokens) {
    const hit = folderTokens.findIndex((f, i) => !used.has(i) && tokensMatch(token, f));
    if (hit !== -1) {
      used.add(hit);
      shared += 1;
    }
  }
  if (shared === 0) return 0;
  return (shared / (roomTokens.length + folderTokens.length - shared)) * 0.8;
}

/** Below this a room is treated as unmatched rather than guessed. */
export const MIN_ROOM_MATCH = 0.5;

// ------------------------------------------------------------------
// Drive client
// ------------------------------------------------------------------

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveError";
  }
}

/**
 * Lists Drive folders, caching per instance. One instance per import run, so a
 * sheet with 40 rows all pointing at the same property folder costs one listing,
 * not forty.
 */
export class DriveImageClient {
  private cache = new Map<string, DriveFolder | null>();
  private drive: unknown = null;

  static isConfigured(): boolean {
    return hasServiceAccount();
  }

  static missingCredentialsMessage(): string {
    return "Google Drive image import needs a service account on the server (GOOGLE_SERVICE_ACCOUNT_JSON). Photos were skipped; everything else imported normally.";
  }

  private async client() {
    if (!this.drive) {
      const { google } = await import("googleapis");
      const auth = await googleJwt([DRIVE_SCOPE]);
      this.drive = google.drive({ version: "v3", auth });
    }
    return this.drive as {
      files: {
        list: (params: Record<string, unknown>) => Promise<{
          data: { files?: { id?: string | null; name?: string | null; mimeType?: string | null }[] };
        }>;
      };
    };
  }

  /** List one folder's subfolders and images. Cached, including misses. */
  async listFolder(folderId: string): Promise<DriveFolder | null> {
    const cached = this.cache.get(folderId);
    if (cached !== undefined) return cached;

    const drive = await this.client();
    let files: { id?: string | null; name?: string | null; mimeType?: string | null }[];
    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "files(id,name,mimeType)",
        pageSize: 1000,
        orderBy: "name",
        // Needed for folders living in a shared drive rather than My Drive.
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      files = res.data.files ?? [];
    } catch (err) {
      const status = (err as { code?: number })?.code;
      const email = serviceAccountEmail();
      if (status === 403 || status === 404) {
        throw new DriveError(
          `Cannot open that Drive folder.${email ? ` Share it (Viewer) with ${email}, or` : " Set it to"} “Anyone with the link — Viewer”.`
        );
      }
      throw new DriveError("Google Drive request failed.");
    }

    const subfolders: DriveFile[] = [];
    const images: DriveFile[] = [];
    for (const file of files) {
      if (!file.id || !file.name) continue;
      if (file.mimeType === FOLDER_MIME) {
        if (subfolders.length < MAX_SUBFOLDERS) subfolders.push({ id: file.id, name: file.name });
      } else if ((file.mimeType ?? "").startsWith("image/")) {
        if (images.length < MAX_FILES_PER_FOLDER) images.push({ id: file.id, name: file.name });
      }
    }

    const folder: DriveFolder = { id: folderId, subfolders, images };
    this.cache.set(folderId, folder);
    return folder;
  }

  /**
   * Resolve the photos for one room within a property folder.
   *
   * Order matters — `first_photo_url` becomes the listing's thumbnail, so the
   * room's own photos always come before communal ones.
   */
  async imagesForRoom(propertyFolderId: string, roomLabel: string | null): Promise<RoomImages> {
    const property = await this.listFolder(propertyFolderId);
    if (!property) return { urls: [], matchedFolder: null };

    const usable = property.subfolders.filter((f) => !isExcludedFolder(f.name));
    const communalFolders = usable.filter((f) => isCommunalFolder(f.name));
    const roomFolders = usable.filter((f) => !isCommunalFolder(f.name));

    // Best-scoring non-communal subfolder for this room label.
    let matched: DriveFile | null = null;
    if (roomLabel) {
      let best = 0;
      for (const folder of roomFolders) {
        const score = roomFolderScore(roomLabel, folder.name);
        if (score > best) {
          best = score;
          matched = folder;
        }
      }
      if (best < MIN_ROOM_MATCH) matched = null;
    }

    const urls: string[] = [];
    if (matched) {
      const contents = await this.listFolder(matched.id);
      for (const image of contents?.images ?? []) urls.push(driveImageUrl(image.id));
    }

    // Loose images in the property folder apply to the whole property.
    for (const image of property.images) urls.push(driveImageUrl(image.id));

    for (const folder of communalFolders) {
      const contents = await this.listFolder(folder.id);
      for (const image of contents?.images ?? []) urls.push(driveImageUrl(image.id));
    }

    return {
      // De-duplicated: a folder that is both matched and communal would
      // otherwise contribute twice.
      urls: [...new Set(urls)].slice(0, MAX_PHOTOS_PER_ROW),
      matchedFolder: matched?.name ?? null,
    };
  }

  /** Room-ish subfolder names in a property folder, for "no match" diagnostics. */
  async roomFolderNames(propertyFolderId: string): Promise<string[]> {
    const property = await this.listFolder(propertyFolderId);
    return (property?.subfolders ?? [])
      .filter((f) => !isCommunalFolder(f.name) && !isExcludedFolder(f.name))
      .map((f) => f.name);
  }
}
