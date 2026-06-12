// Stage 6: property images. Each Property cell links a Google Drive folder.
// Lists the folder (Drive API via GOOGLE_SERVICE_ACCOUNT_PATH if available,
// otherwise the public embeddedfolderview page), downloads image files,
// uploads them to the property_photos bucket and inserts unit_photos rows.
// Skips anything already attached (matched by source filename in the path).
// Dry run lists what would upload; only --commit writes.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const IMG_EXT = /\.(jpe?g|png|webp)$/i;
export const VIDEO_EXT = /\.(mp4|mov|3gp|webm|avi|mkv)$/i;
const CACHE_DIR = "import/images";

export function folderIdFrom(url) {
  return url?.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

async function listViaDriveApi(folderId) {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (!keyPath || !existsSync(keyPath)) return null;
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files.map((f) => ({ id: f.id, name: f.name, isFolder: f.mimeType === "application/vnd.google-apps.folder" }));
}

// Public folders expose an HTML listing at embeddedfolderview (no auth).
async function listViaEmbeddedView(folderId) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`);
  if (!res.ok) return null;
  const html = await res.text();
  const out = [];
  const re = /<div class="flip-entry" id="entry-([A-Za-z0-9_-]+)"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
  for (const m of html.matchAll(re)) out.push({ id: m[1], name: m[2], isFolder: !/\.[a-z0-9]{2,5}$/i.test(m[2]) });
  return out.length ? out : null;
}

export async function listFolder(folderId, log) {
  try {
    const api = await listViaDriveApi(folderId);
    if (api) return api;
  } catch (e) {
    log.push({ level: "warn", message: `Drive API listing failed for ${folderId}: ${e.message} — falling back to public listing` });
  }
  try {
    return await listViaEmbeddedView(folderId);
  } catch (e) {
    log.push({ level: "warn", message: `public folder listing failed for ${folderId}: ${e.message}` });
    return null;
  }
}

async function downloadFile(fileId, dest) {
  for (const url of [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ]) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const head = buf.subarray(0, 12).toString("latin1");
    if (head.includes("<!DOCTYPE") || head.includes("<html")) continue;
    writeFileSync(dest, buf);
    return true;
  }
  return false;
}

const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();

export async function runImagesStage(sb, graph, diff, system, { commit = false } = {}) {
  const log = [];
  const planned = [];
  mkdirSync(CACHE_DIR, { recursive: true });

  // property graph key -> db id resolved by the diff
  const propIds = new Map();
  for (const p of graph.properties) {
    const create = diff.entities.properties.creates.find((c) => c.key === p.key);
    const update = [...diff.entities.properties.updates, ...diff.entities.properties.unchanged].find((u) => u.key === p.key);
    const id = create?.id ?? update?.dbId ?? null;
    if (id) propIds.set(p.key, { id, property: p });
  }

  // Global skip-set: a Drive file already attached anywhere must never be
  // re-uploaded (photos may have been re-pointed across properties by the
  // remap pass). Drive ids can contain underscores, so match by literal
  // "import_{id}_" prefix instead of parsing the filename.
  const attachedFilenames = system.unitPhotos.map((ph) => ph.url.slice(ph.url.lastIndexOf("/") + 1));
  const isAttached = (driveId) => attachedFilenames.some((f) => f.startsWith(`import_${driveId}_`));
  const { FOLDER_PROPERTY_OVERRIDES } = await import("../config.mjs");
  const dbPropByName = new Map(system.properties.map((p) => [p.name.trim().toLowerCase(), p]));

  for (const [key, { id: resolvedId, property }] of propIds) {
    const folderId = folderIdFrom(property.driveFolderUrl);
    if (!folderId) {
      log.push({ level: "info", message: `"${property.name}": no Drive folder link — skipped` });
      continue;
    }
    // Folder override (e.g. the row-21 Everard chimera): upload to the real owner.
    let propertyId = resolvedId;
    const ovrName = FOLDER_PROPERTY_OVERRIDES[folderId];
    if (ovrName) {
      const target = dbPropByName.get(ovrName.trim().toLowerCase());
      if (target) {
        propertyId = target.id;
        log.push({ level: "info", message: `"${property.name}": folder override -> uploads attach to "${target.name}"` });
      }
    }
    // Recursive walk (the first import only went one level deep and missed
    // nested room folders like D5/ROOM D5 (3)).
    const files = [];
    async function collect(fid, depth) {
      if (depth > 4) return false;
      const entries = await listFolder(fid, log);
      if (!entries) return false;
      for (const e of entries) {
        if (e.isFolder) await collect(e.id, depth + 1);
        else files.push(e);
      }
      return true;
    }
    if (!(await collect(folderId, 0))) {
      log.push({ level: "warn", message: `"${property.name}": cannot list Drive folder ${folderId} (not public / API unavailable) — download images manually into ${CACHE_DIR}/${key}` });
      continue;
    }
    const images = files.filter((f) => IMG_EXT.test(f.name));
    if (!images.length) {
      log.push({ level: "info", message: `"${property.name}": no image files in folder (${files.length} other files)` });
      continue;
    }

    const plannedIds = new Set();
    for (const img of images) {
      // Drive file id in the path: identical filenames across subfolders must
      // not collide (and must stay skippable on rerun).
      if (isAttached(img.id) || plannedIds.has(img.id)) continue; // already attached anywhere
      const fname = `${img.id}_${sanitize(img.name)}`;
      const storagePath = `${system.tenantId}/${propertyId}/communal/communal/import_${fname}`;
      plannedIds.add(img.id);
      planned.push({ propertyKey: key, propertyName: property.name, propertyId, driveId: img.id, name: img.name, storagePath });
    }
  }

  log.push({ level: "info", message: `${planned.length} new images to attach${commit ? "" : " (dry run — nothing uploaded)"}` });
  if (!commit) return { committed: false, planned, log };

  let uploaded = 0;
  for (const item of planned) {
    const local = path.join(CACHE_DIR, sanitize(`${item.driveId}_${item.name}`));
    if (!existsSync(local) && !(await downloadFile(item.driveId, local))) {
      log.push({ level: "warn", message: `download failed: ${item.propertyName} / ${item.name}` });
      continue;
    }
    const ext = item.name.match(IMG_EXT)?.[1]?.toLowerCase() ?? "jpg";
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const { error } = await sb.storage.from("property_photos").upload(item.storagePath, readFileSync(local), { contentType, upsert: true });
    if (error) {
      log.push({ level: "warn", message: `upload failed ${item.name}: ${error.message}` });
      continue;
    }
    const { data } = sb.storage.from("property_photos").getPublicUrl(item.storagePath);
    const { error: insErr } = await sb.from("unit_photos").insert({
      tenant_id: system.tenantId, property_id: item.propertyId, unit_id: null,
      url: data.publicUrl, category: "communal",
    });
    if (insErr) log.push({ level: "warn", message: `unit_photos insert failed ${item.name}: ${insErr.message}` });
    else { uploaded++; log.push({ level: "ok", message: `${item.propertyName}: attached ${item.name}` }); }
  }
  return { committed: true, planned, uploaded, log };
}
