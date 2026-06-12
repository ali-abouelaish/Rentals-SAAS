// Remap pass: re-categorize imported property photos onto their rooms.
//
// The first image import attached everything as property-level communal. The
// Drive structure is: room photos live in subfolders named with unit codes
// (D1, M5, ENS5, "ROOM B", "Master 1", ...) inside each property folder;
// communal photos sit loose in the folder root (or in communal-space
// subfolders like "Kitchen" / "Common Areas"). This pass re-lists each
// property's Drive folder (recursively; nested files attribute to their
// top-level subfolder), maps every Drive file id to that subfolder, aliases
// the subfolder name to the property's unit codes (case-insensitive, with
// ROOM/Master/En-suite/digit transforms), and UPDATEs the existing
// unit_photos rows. No re-upload, no storage moves — the app derives
// room/communal entirely from the DB row (unit_id null/not-null + category;
// deletion re-derives the path from the stored url), so the storage path is
// never interpreted.
//
//   node --env-file=.env.local import/remap-images.mjs            # dry run
//   node --env-file=.env.local import/remap-images.mjs --commit   # apply
//
// Notes:
// - Drive file ids can contain underscores, so storage filenames are NOT
//   parsed; each known id from the fresh folder listing is matched as a
//   literal "import_{id}_" prefix.
// - Root-level files stay communal. Communal-space subfolders (Kitchen,
//   Common Areas, ...) get their category fixed via
//   COMMUNAL_SUBFOLDER_CATEGORIES. Unknown subfolder names stay communal and
//   are listed in the report. Ambiguous unit matches are never applied.
// - FOLDER_PROPERTY_OVERRIDES re-points photos that landed on the wrong
//   property (the row-21 "Everard House" chimera of 12 Jun 2026).
// - Video files (WhatsApp .mp4 etc.) were never uploaded — the
//   property_photos bucket only allows image/jpeg|png|webp — counted per
//   folder. Images that exist in Drive but were never uploaded (nested
//   sub-subfolders the first import didn't walk) are counted as
//   "not yet uploaded"; rerun the main pipeline with --images to fetch them.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DEFAULT_TENANT_ID, OUT_DIR, FOLDER_PROPERTY_OVERRIDES, COMMUNAL_SUBFOLDER_CATEGORIES } from "./config.mjs";
import { adminClient } from "./lib/db.mjs";
import { listFolder, folderIdFrom, IMG_EXT, VIDEO_EXT } from "./lib/images.mjs";
import { slugify } from "./lib/util.mjs";

const has = (name) => process.argv.includes(`--${name}`);
const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};

// ---- subfolder name -> candidate unit-code slugs ---------------------------
export function subfolderVariants(name) {
  let s = slugify(name); // strips emoji/symbols: "🌟ROOM A-ENSUITE" -> "room-a-ensuite"
  s = s.replace(/^(room|rm)-/, "");
  const out = new Set([s]);
  const flat = s.replace(/-/g, "");
  out.add(flat);
  out.add(flat.replace(/^master/, "m")); // "Master 1" -> "m1"
  if (flat.includes("ensuite")) {
    const rest = flat.replace("ensuite", "");
    out.add(rest ? `ens${rest}` : "ens"); // "A-ENSUITE" -> "ensa"; "En-suite" -> "ens"
    if (rest) out.add(`${rest}ens`);
  }
  out.delete("");
  return out;
}

export function matchUnit(subfolder, units) {
  const variants = subfolderVariants(subfolder);
  const flatSlug = (u) => slugify(u.room_number ?? "").replace(/-/g, "");
  const exact = units.filter((u) => variants.has(flatSlug(u)));
  if (exact.length === 1) return { unit: exact[0], how: "exact" };
  if (exact.length > 1) return { unit: null, how: "ambiguous" };
  // Pure digits: "Room 3" -> the unique unit code ending in 3 (D3) — but not
  // when several do (D3 vs ENS3).
  for (const v of variants) {
    if (/^\d+$/.test(v)) {
      const hits = units.filter((u) => flatSlug(u).endsWith(v));
      if (hits.length === 1) return { unit: hits[0], how: "digit" };
      if (hits.length > 1) return { unit: null, how: "ambiguous" };
    }
  }
  // Unique prefix containment ("B" folder vs "B Master" room, "ens" vs ENS6).
  // A unit code may only be a prefix of the folder name when it is >= 2 chars,
  // otherwise "Conservatory" would match unit "C".
  const fuzzy = units.filter((u) => {
    const us = flatSlug(u);
    return us && [...variants].some((v) => v.length >= 1 && (us.startsWith(v) || (v.startsWith(us) && us.length >= 2)));
  });
  if (fuzzy.length === 1) return { unit: fuzzy[0], how: "fuzzy" };
  if (fuzzy.length > 1) return { unit: null, how: "ambiguous" };
  // Letter-prefixed digits where the property uses bare digit codes:
  // folder "D1" -> unit "1" at Birchfield (units 1-4, no "d" codes anywhere).
  for (const v of variants) {
    const m = v.match(/^([a-z]+)(\d+)$/);
    if (m && !units.some((u) => flatSlug(u).includes(m[1]))) {
      const hits = units.filter((u) => flatSlug(u) === m[2]);
      if (hits.length === 1) return { unit: hits[0], how: "digit" };
    }
  }
  return { unit: null, how: "unknown" };
}

function communalCategoryFor(subfolder) {
  const key = subfolder.trim().toLowerCase().replace(/\s+/g, " ");
  return COMMUNAL_SUBFOLDER_CATEGORIES[key] ?? COMMUNAL_SUBFOLDER_CATEGORIES[key.replace(/\s*\d+$/, "")] ?? null;
}

async function main() {
  const tenantId = arg("tenant", DEFAULT_TENANT_ID);
  const commit = has("commit");
  const rawLog = [];

  const graphPath = path.join(OUT_DIR, "graph.json");
  if (!existsSync(graphPath)) throw new Error(`${graphPath} missing — run the main pipeline first (it provides the Drive folder URLs)`);
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));

  const sb = adminClient();
  const fetchAll = async (table, columns) => {
    const { data, error } = await sb.from(table).select(columns).eq("tenant_id", tenantId).order("id").limit(5000);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    return data;
  };
  const [photos, units, properties] = await Promise.all([
    fetchAll("unit_photos", "id, property_id, unit_id, url, category"),
    fetchAll("units", "id, property_id, room_number"),
    fetchAll("properties", "id, name, postcode"),
  ]);
  const propName = new Map(properties.map((p) => [p.id, p.name]));
  const propByName = new Map(properties.map((p) => [p.name.trim().toLowerCase(), p]));
  const unitsByProp = new Map();
  for (const u of units) unitsByProp.set(u.property_id, [...(unitsByProp.get(u.property_id) ?? []), u]);

  const imported = photos.filter((ph) => ph.url.includes("/import_") && ph.property_id);
  console.log(`unit_photos: ${photos.length} total, ${imported.length} imported rows in scope (tenant ${tenantId})`);

  // ---- recursive Drive listing: file id -> top-level subfolder -------------
  // Nested folders attribute to their TOP-level subfolder (D5/ROOM D5 (3)/x.jpg -> D5).
  const fileParent = new Map(); // driveFileId -> { subfolder: string|null, propertyKey, folderId, name }
  const folderStats = new Map();
  async function walk(folderId, propertyKey, topSubfolder, stats, depth) {
    if (depth > 4) return;
    const entries = await listFolder(folderId, rawLog);
    if (!entries) {
      if (depth === 0) rawLog.push({ level: "warn", message: `cannot list Drive folder ${folderId} — its photos keep their current categorization` });
      return;
    }
    for (const e of entries) {
      if (e.isFolder) {
        const top = topSubfolder ?? e.name;
        if (!stats.subfolders.has(top)) stats.subfolders.set(top, { images: 0, videos: 0, other: 0 });
        await walk(e.id, propertyKey, top, stats, depth + 1);
      } else {
        fileParent.set(e.id, { subfolder: topSubfolder, propertyKey, folderId, name: e.name });
        const bucket = topSubfolder ? stats.subfolders.get(topSubfolder) : stats;
        const keyImg = topSubfolder ? "images" : "rootImages";
        const keyVid = topSubfolder ? "videos" : "rootVideos";
        const keyOth = topSubfolder ? "other" : "rootOther";
        if (IMG_EXT.test(e.name)) bucket[keyImg]++;
        else if (VIDEO_EXT.test(e.name)) bucket[keyVid]++;
        else bucket[keyOth]++;
      }
    }
  }
  for (const p of graph.properties) {
    const folderId = folderIdFrom(p.driveFolderUrl);
    if (!folderId) continue;
    const stats = { name: p.name, rootImages: 0, rootVideos: 0, rootOther: 0, subfolders: new Map() };
    folderStats.set(p.key, stats);
    await walk(folderId, p.key, null, stats, 0);
  }
  console.log(`Drive listing: ${fileParent.size} files across ${folderStats.size} property folders (recursive)`);

  // ---- resolve folder override targets --------------------------------------
  const overrideTarget = new Map(); // top-level folderId -> db property row
  for (const [fid, dbName] of Object.entries(FOLDER_PROPERTY_OVERRIDES)) {
    const target = propByName.get(dbName.trim().toLowerCase());
    if (target) overrideTarget.set(fid, target);
    else rawLog.push({ level: "warn", message: `FOLDER_PROPERTY_OVERRIDES target "${dbName}" not found in DB — override inactive` });
  }
  // graph property key -> its top-level folder id (for override lookup)
  const folderOfProp = new Map(graph.properties.map((p) => [p.key, folderIdFrom(p.driveFolderUrl)]).filter(([, f]) => f));

  // ---- walk the imported rows ------------------------------------------------
  const knownIds = [...fileParent.keys()];
  const plan = []; // { photoId, set: {unit_id?, category?, property_id?}, room?, propertyId, subfolder?, kind }
  const perProperty = new Map();
  const stat = (pid) => {
    if (!perProperty.has(pid)) {
      perProperty.set(pid, {
        communal: 0, alreadyRoom: 0, unlisted: 0, repointed: 0,
        rooms: new Map(), categories: new Map(), unknown: new Map(), ambiguous: new Map(),
      });
    }
    return perProperty.get(pid);
  };

  for (const ph of imported) {
    const fname = ph.url.slice(ph.url.lastIndexOf("/") + 1);
    const driveId = knownIds.find((id) => fname.startsWith(`import_${id}_`));
    if (!driveId) { stat(ph.property_id).unlisted++; continue; }
    const parent = fileParent.get(driveId);

    // Folder override: photo belongs to a different property than it was uploaded to.
    let targetPropertyId = ph.property_id;
    const ovr = overrideTarget.get(folderOfProp.get(parent.propertyKey));
    if (ovr && ovr.id !== ph.property_id) targetPropertyId = ovr.id;
    const s = stat(targetPropertyId);
    if (targetPropertyId !== ph.property_id) s.repointed++;

    const setProp = targetPropertyId !== ph.property_id ? { property_id: targetPropertyId } : {};

    if (!parent.subfolder) {
      // root file — communal
      s.communal++;
      if (Object.keys(setProp).length) plan.push({ photoId: ph.id, set: setProp, propertyId: targetPropertyId, kind: "repoint" });
      continue;
    }

    const communalCat = communalCategoryFor(parent.subfolder);
    if (communalCat) {
      s.categories.set(communalCat, (s.categories.get(communalCat) ?? 0) + 1);
      const set = { ...setProp };
      if (ph.category !== communalCat) set.category = communalCat;
      if (ph.unit_id) set.unit_id = null;
      if (Object.keys(set).length) plan.push({ photoId: ph.id, set, propertyId: targetPropertyId, subfolder: parent.subfolder, kind: "category" });
      continue;
    }

    const { unit, how } = matchUnit(parent.subfolder, unitsByProp.get(targetPropertyId) ?? []);
    if (!unit) {
      const bucket = how === "ambiguous" ? s.ambiguous : s.unknown;
      bucket.set(parent.subfolder, (bucket.get(parent.subfolder) ?? 0) + 1);
      if (Object.keys(setProp).length) plan.push({ photoId: ph.id, set: setProp, propertyId: targetPropertyId, subfolder: parent.subfolder, kind: "repoint" });
      continue; // stays communal, listed in report
    }
    if (ph.unit_id === unit.id && ph.category === "room" && !Object.keys(setProp).length) { s.alreadyRoom++; continue; }
    s.rooms.set(unit.room_number, (s.rooms.get(unit.room_number) ?? 0) + 1);
    plan.push({ photoId: ph.id, set: { ...setProp, unit_id: unit.id, category: "room" }, room: unit.room_number, propertyId: targetPropertyId, subfolder: parent.subfolder, kind: how === "exact" ? "room" : `room(${how})` });
  }

  // ---- "in Drive but never uploaded" gap (nested folders the import missed) --
  const uploadedIds = new Set();
  for (const ph of imported) {
    const fname = ph.url.slice(ph.url.lastIndexOf("/") + 1);
    const id = knownIds.find((k) => fname.startsWith(`import_${k}_`));
    if (id) uploadedIds.add(id);
  }
  const notUploaded = new Map(); // propertyKey -> count
  for (const [id, parent] of fileParent) {
    if (!uploadedIds.has(id) && IMG_EXT.test(parent.name)) {
      notUploaded.set(parent.propertyKey, (notUploaded.get(parent.propertyKey) ?? 0) + 1);
    }
  }

  // ---- dedupe noisy log lines -------------------------------------------------
  const seenMsg = new Set();
  const log = rawLog.filter((l) => {
    const key = l.message.replace(/[A-Za-z0-9_-]{15,}/g, "*").slice(0, 120);
    if (seenMsg.has(key)) return false;
    seenMsg.add(key);
    return true;
  });

  // ---- report -------------------------------------------------------------------
  const lines = [];
  lines.push(`# Image remap ${commit ? "(COMMITTED)" : "(dry run)"} — ${plan.length} unit_photos rows to update\n`);
  const updateKinds = plan.reduce((m, p) => { m[p.kind] = (m[p.kind] ?? 0) + 1; return m; }, {});
  lines.push(`Updates by kind: ${Object.entries(updateKinds).map(([k, n]) => `${k}: ${n}`).join(", ") || "none"}\n`);

  if (overrideTarget.size) {
    lines.push(`> **Note — row-21 chimera:** the live sheet's AP row 21 was repurposed to "Everard House" (room A) but kept Broxbourne's Bow / E3 3LJ, which created a duplicate property on 12 Jun (id e3e6f4c8…, 1 unit "A"). Its 18 photos are re-pointed to "15 Everard House" by FOLDER_PROPERTY_OVERRIDES. **Action for you:** fix row 21 in the sheet (correct area/postcode, or move it to the Horizon section), then delete the chimera property in the app — the importer never deletes.\n`);
  }

  for (const [pid, s] of [...perProperty.entries()].sort((a, b) => (propName.get(a[0]) ?? "").localeCompare(propName.get(b[0]) ?? ""))) {
    lines.push(`## ${propName.get(pid) ?? pid}`);
    lines.push(`- communal (folder root): ${s.communal}${s.alreadyRoom ? `, already room-linked: ${s.alreadyRoom}` : ""}${s.unlisted ? `, not in current Drive listing: ${s.unlisted} (left as-is)` : ""}${s.repointed ? `, re-pointed from another property: ${s.repointed}` : ""}`);
    const rooms = [...s.rooms.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (rooms.length) lines.push(`- rooms: ${rooms.map(([r, n]) => `${r}: ${n}`).join(", ")}`);
    const cats = [...s.categories.entries()];
    if (cats.length) lines.push(`- communal categorized: ${cats.map(([c, n]) => `${c}: ${n}`).join(", ")}`);
    for (const [sf, n] of s.unknown) lines.push(`- UNMATCHED subfolder "${sf}" (${n} photos) — stays communal, map manually`);
    for (const [sf, n] of s.ambiguous) lines.push(`- AMBIGUOUS subfolder "${sf}" (${n} photos) — matches multiple unit codes, stays communal`);
    lines.push("");
  }

  // Possible duplicate units: one room code a strict prefix of another on the
  // same property (e.g. "B" from the prior import vs "B Master" from the
  // sheet) — photo assignment picks the exact-slug match, so verify these.
  const dupUnitNotes = [];
  for (const [pid, us] of unitsByProp) {
    const flat = us.map((u) => ({ u, s: slugify(u.room_number ?? "").replace(/-/g, "") })).filter((x) => x.s);
    for (const a of flat) for (const b of flat) {
      if (a !== b && a.s !== b.s && b.s.startsWith(a.s)) {
        dupUnitNotes.push(`- ${propName.get(pid)}: units "${a.u.room_number}" and "${b.u.room_number}" look like the same room — merge manually (photos currently assigned to the exact match)`);
      }
    }
  }
  if (dupUnitNotes.length) {
    lines.push(`## Possible duplicate units (verify and merge in the app)`);
    lines.push(...new Set(dupUnitNotes));
    lines.push("");
  }

  lines.push(`## Drive content never uploaded (videos blocked by bucket mime types; nested images need an --images rerun)`);
  for (const [, st] of folderStats) {
    const subs = [...st.subfolders.entries()];
    const vids = st.rootVideos + subs.reduce((n, [, x]) => n + x.videos, 0);
    const other = st.rootOther + subs.reduce((n, [, x]) => n + x.other, 0);
    const missing = notUploaded.get([...folderStats.entries()].find(([, v]) => v === st)?.[0]) ?? 0;
    if (vids || other || missing) {
      lines.push(`- ${st.name}: ${missing} image(s) in Drive not yet uploaded, ${vids} video file(s) skipped, ${other} other file(s) skipped`);
    }
  }
  lines.push("");
  for (const l of log) lines.push(`- [${l.level}] ${l.message}`);

  const reportPath = path.join(OUT_DIR, "remap_report.md");
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(reportPath, lines.join("\n") + "\n");
  writeFileSync(path.join(OUT_DIR, "remap.json"), JSON.stringify({ commit, plan, log }, null, 2));
  console.log("\n" + lines.join("\n"));
  console.log(`\nReport: ${reportPath}`);

  // ---- apply --------------------------------------------------------------------
  if (!commit) {
    console.log(`\nDry run — ${plan.length} unit_photos rows would be updated. Re-run with --commit to apply.`);
    return;
  }
  // Batch rows sharing an identical update payload.
  const groups = new Map();
  for (const p of plan) {
    const key = JSON.stringify(p.set);
    groups.set(key, [...(groups.get(key) ?? []), p.photoId]);
  }
  let updated = 0;
  for (const [setJson, ids] of groups) {
    const { error } = await sb.from("unit_photos").update(JSON.parse(setJson)).in("id", ids).eq("tenant_id", tenantId);
    if (error) throw new Error(`update batch failed: ${error.message} (${updated}/${plan.length} done — rerun to continue, the pass is idempotent)`);
    updated += ids.length;
  }
  console.log(`\nCommitted: ${updated} rows updated across ${groups.size} batches.`);
}

main().catch((e) => { console.error(`FATAL: ${e.stack ?? e}`); process.exitCode = 1; });
