// Stage 4: match the sheet entity graph against current database state and
// classify everything as create / update / unchanged / system_only / review.
//
// Matching is two-pass: import_ref exact first (when the migration has been
// applied), then natural keys against unmatched rows. Confident natural-key
// matches get an import_ref backfill op so future reruns are exact-keyed.
//
// Conflict policy (open question 8 still unanswered): a blank/placeholder DB
// value is auto-filled from the sheet; a genuine value conflict is REPORTED,
// never applied — unless it is a canonical-map spelling fix (decision already
// made) or --precedence=sheet is passed for availability/rent fields.

import { randomUUID } from "node:crypto";
import { PORTFOLIOS, AREA_MAP, PROPERTY_POSTCODE, PROPERTY_DB_ALIASES, EMAIL_FIX_MAP, KEY_ROW, UNKNOWN_CONTACT } from "../config.mjs";
import { slugify, normSpace, normPostcode, fuzzyNameMatch, addDays, todayIso } from "./util.mjs";
import { normalizePhone } from "./normalize.mjs";

const AVAILABILITY_FIELDS = new Set(["status", "available_date", "min_price_pcm", "max_price_pcm", "deposit", "rent_pcm"]);

const blankish = (v) =>
  v == null || v === "" || (typeof v === "string" && (v.trim() === "" || v.trim().toLowerCase() === UNKNOWN_CONTACT));

function e164OrNull(raw) {
  if (!raw || blankish(raw)) return null;
  const n = normalizePhone(raw);
  return n.phone?.startsWith("+") ? n.phone : null;
}

// Is db->sheet a config-map spelling/canonicalization fix (auto-applied)?
function isCanonicalFix(field, dbVal, sheetVal, ctx = {}) {
  if (dbVal == null || sheetVal == null) return false;
  const d = String(dbVal), s = String(sheetVal);
  if (field === "area") return (AREA_MAP[d.toLowerCase().trim()] ?? normSpace(d)) === s;
  if (field === "postcode") {
    if (normPostcode(d) === normPostcode(s)) return true;
    return ctx.propertyName != null && PROPERTY_POSTCODE[ctx.propertyName] != null &&
      normPostcode(PROPERTY_POSTCODE[ctx.propertyName]) === normPostcode(s);
  }
  if (field === "email") {
    if (d.trim().toLowerCase() === s.trim().toLowerCase()) return true; // case-only fix
    return EMAIL_FIX_MAP[d.toLowerCase().trim()] === s;
  }
  if (field === "phone" || field === "whatsapp_number") {
    const de = e164OrNull(d);
    return de != null && de === s; // same number, formatting fix only
  }
  if (field === "full_name" || field === "name" || field === "room_number") {
    return slugify(d) === slugify(s); // casing/whitespace fix only
  }
  return false;
}

function valuesEqual(field, a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (field === "postcode") return normPostcode(String(a)) === normPostcode(String(b));
  if (field === "name" || field === "address_line_1") {
    // DB names/addresses carry house numbers the sheet lacks ("10 Barnando
    // Gardens" vs "Barnando Gardens") — containment either way is the same place.
    const sa = slugify(a), sb = slugify(b);
    if (sa === sb || sa.includes(sb) || sb.includes(sa)) return true;
  }
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return normSpace(String(a)) === normSpace(String(b));
}

// Drop a leading house number ("149 Trundley's Road" -> "Trundley's Road").
const stripHouseNo = (s) => normSpace(String(s ?? "").replace(/^\d+[a-zA-Z]?\s+/, ""));

export function runDiff(graph, system, { precedence = "report" } = {}) {
  const tenantId = system.tenantId;
  const today = todayIso();
  const ops = [];
  const review = [];
  const result = {};
  let seq = 0;

  const matchedDbIds = {
    portfolios: new Set(), properties: new Set(), units: new Set(),
    pmTenants: new Set(), contracts: new Set(), keys: new Set(), bankDetails: new Set(),
  };

  const addOp = (op) => { ops.push({ seq: ++seq, ...op }); return ops[ops.length - 1]; };
  const addReview = (item) => review.push(item);

  // Generic field-diff: returns { autoFields, conflicts, identical }
  function diffFields(fieldPairs, dbRow, ctx = {}) {
    const autoFields = {};
    const conflicts = [];
    for (const [col, sheetVal] of Object.entries(fieldPairs)) {
      if (sheetVal == null) continue; // a blank sheet value never overwrites the system
      const dbVal = dbRow[col];
      if (valuesEqual(col, dbVal, sheetVal)) continue;
      if (blankish(dbVal)) { autoFields[col] = sheetVal; continue; }
      if (isCanonicalFix(col, dbVal, sheetVal, ctx)) { autoFields[col] = sheetVal; continue; }
      // --precedence=sheet applies ONLY to unit availability fields, never to
      // contract money/status columns that share the same names.
      if (precedence === "sheet" && ctx.allowSheetPrecedence && AVAILABILITY_FIELDS.has(col)) { autoFields[col] = sheetVal; continue; }
      conflicts.push({ field: col, before: dbVal, after: sheetVal });
    }
    return { autoFields, conflicts };
  }

  function classify(bucket, entityType, { key, sheetRow, dbRow, fieldPairs, label, importRef, table, ctx }) {
    const { autoFields, conflicts } = diffFields(fieldPairs, dbRow, ctx);
    const needsRefBackfill = system.importRefReady && importRef && blankish(dbRow.import_ref);
    if (needsRefBackfill) autoFields.import_ref = importRef;

    for (const c of conflicts) {
      addReview({
        entityType, key, label, sheetRow, dbId: dbRow.id,
        field: c.field, before: c.before, after: c.after,
        reason: "sheet and system disagree on a populated field (Q8 precedence unanswered) — reported, not applied",
      });
    }
    if (Object.keys(autoFields).length) {
      const op = addOp({ kind: "update", table, id: dbRow.id, values: autoFields, label });
      bucket.updates.push({ key, label, dbId: dbRow.id, fields: autoFields, conflicts, opSeq: op.seq });
    } else if (conflicts.length) {
      bucket.updates.push({ key, label, dbId: dbRow.id, fields: {}, conflicts });
    } else {
      bucket.unchanged.push({ key, label, dbId: dbRow.id });
    }
  }

  // ---- portfolios ------------------------------------------------------------
  {
    const bucket = (result.portfolios = { creates: [], updates: [], unchanged: [], systemOnly: [] });
    graph.portfolioIds = {};
    for (const [companyKey, cfg] of [["ap", PORTFOLIOS.AP], ["horizon", PORTFOLIOS.HORIZON]]) {
      const importRef = `pp-org:${companyKey}`;
      let dbRow =
        (system.importRefReady && system.portfolios.find((p) => p.import_ref === importRef)) ||
        system.portfolios.find((p) => !matchedDbIds.portfolios.has(p.id) && normSpace(p.name).toLowerCase() === cfg.name.toLowerCase());
      if (dbRow) {
        matchedDbIds.portfolios.add(dbRow.id);
        graph.portfolioIds[companyKey] = dbRow.id;
        classify(bucket, "portfolio", {
          key: importRef, sheetRow: null, dbRow, table: "portfolios", importRef,
          label: `portfolio "${cfg.name}"`, fieldPairs: {}, ctx: {},
        });
      } else {
        const id = randomUUID();
        graph.portfolioIds[companyKey] = id;
        const values = { id, tenant_id: tenantId, name: cfg.name, color: cfg.color };
        if (system.importRefReady) values.import_ref = importRef;
        addOp({ kind: "insert", table: "portfolios", id, values, label: `create portfolio "${cfg.name}"` });
        bucket.creates.push({ key: importRef, label: cfg.name, id });
      }
    }
    for (const p of system.portfolios) {
      if (!matchedDbIds.portfolios.has(p.id)) bucket.systemOnly.push({ dbId: p.id, label: `portfolio "${p.name}" (not in sheet — untouched)` });
    }
  }

  // ---- properties ------------------------------------------------------------
  const propertyDbId = new Map(); // graph property key -> db id (existing or pending)
  {
    const bucket = (result.properties = { creates: [], updates: [], unchanged: [], systemOnly: [], review: [] });
    for (const p of graph.properties) {
      const importRef = p.key;
      const portfolioId = graph.portfolioIds[p.company];
      let dbRow = system.importRefReady
        ? system.properties.find((r) => r.import_ref === importRef)
        : null;
      if (!dbRow) {
        const alias = PROPERTY_DB_ALIASES[p.name] ?? null;
        const headAddr = p.addressLine1 ? slugify(p.addressLine1.replace(/,.*$/, "")) : null;
        const nameMatches = (r) => {
          if (alias && slugify(r.name) === slugify(alias)) return true;
          if (fuzzyNameMatch(r.name, p.name)) return true;
          if (fuzzyNameMatch(stripHouseNo(r.name), p.name)) return true;
          // Sheet head address vs DB name/address ("7 Chargrove Close, SE16" vs "7 Chargrove Close")
          if (headAddr && (slugify(r.name) === headAddr || slugify(r.address_line_1 ?? "") === headAddr)) return true;
          return false;
        };
        const candidates = system.properties.filter((r) =>
          !matchedDbIds.properties.has(r.id) &&
          nameMatches(r) &&
          (r.postcode == null || p.postcode == null || normPostcode(r.postcode) === normPostcode(p.postcode)),
        );
        if (candidates.length === 1) {
          dbRow = candidates[0];
          if (dbRow.portfolio_id && dbRow.portfolio_id !== portfolioId) {
            addReview({
              entityType: "property", key: p.key, label: p.name, sheetRow: p.rows[0], dbId: dbRow.id,
              reason: `matched DB property "${dbRow.name}" belongs to a different portfolio — verify company assignment`,
            });
          }
        } else if (candidates.length > 1) {
          addReview({
            entityType: "property", key: p.key, label: p.name, sheetRow: p.rows[0],
            reason: `ambiguous match: ${candidates.length} DB properties (${candidates.map((c) => c.name).join(", ")}) — skipped, resolve manually`,
          });
          bucket.review.push({ key: p.key, label: p.name });
          continue;
        }
      }
      if (dbRow) {
        matchedDbIds.properties.add(dbRow.id);
        propertyDbId.set(p.key, dbRow.id);
        classify(bucket, "property", {
          key: p.key, sheetRow: p.rows[0], dbRow, table: "properties", importRef,
          label: `property "${p.name}"`,
          fieldPairs: {
            name: p.name,
            address_line_1: p.addressLine1,
            postcode: p.postcode,
            area: p.area,
            total_rooms: p.beds,
            total_bathrooms: p.totalBathrooms,
            separate_wc: p.separateWc || null, // only ever sets true; never flips true->false
          },
          ctx: { propertyName: p.name, dbName: dbRow.name },
        });
      } else {
        const id = randomUUID();
        propertyDbId.set(p.key, id);
        const values = {
          id, tenant_id: tenantId, portfolio_id: portfolioId, property_type: "hmo",
          name: p.name, address_line_1: p.addressLine1, postcode: p.postcode, area: p.area,
          total_rooms: p.beds, total_bathrooms: p.totalBathrooms, separate_wc: p.separateWc,
        };
        if (system.importRefReady) values.import_ref = importRef;
        addOp({ kind: "insert", table: "properties", id, values, label: `create property "${p.name}"` });
        bucket.creates.push({ key: p.key, label: p.name, id, values });
      }
    }
    for (const r of system.properties) {
      if (!matchedDbIds.properties.has(r.id)) {
        bucket.systemOnly.push({ dbId: r.id, label: `property "${r.name}" (${r.postcode ?? "no postcode"}) — in system, not in sheet; untouched` });
      }
    }
  }

  // ---- units -----------------------------------------------------------------
  const unitDbId = new Map(); // room key -> db id (existing or pending)
  const unitDbRow = new Map();
  {
    const bucket = (result.units = { creates: [], updates: [], unchanged: [], systemOnly: [], review: [] });
    for (const room of graph.rooms) {
      const importRef = room.key;
      const propId = propertyDbId.get(room.propertyKey);
      if (!propId) {
        addReview({ entityType: "unit", key: room.key, label: room.roomCode, sheetRow: room.sheetRow, reason: "parent property unresolved — unit skipped" });
        bucket.review.push({ key: room.key });
        continue;
      }
      let dbRow = system.importRefReady ? system.units.find((u) => u.import_ref === importRef) : null;
      if (!dbRow) {
        const candidates = system.units.filter((u) =>
          !matchedDbIds.units.has(u.id) && u.property_id === propId &&
          slugify(u.room_number ?? "") === slugify(room.roomCode),
        );
        if (candidates.length === 1) dbRow = candidates[0];
        else if (candidates.length > 1) {
          addReview({
            entityType: "unit", key: room.key, label: `${room.roomCode}`, sheetRow: room.sheetRow,
            reason: `ambiguous: ${candidates.length} DB units share room code "${room.roomCode}" on this property — skipped`,
          });
          bucket.review.push({ key: room.key });
          continue;
        }
      }
      if (dbRow) {
        matchedDbIds.units.add(dbRow.id);
        unitDbId.set(room.key, dbRow.id);
        unitDbRow.set(room.key, dbRow);
        classify(bucket, "unit", {
          key: room.key, sheetRow: room.sheetRow, dbRow, table: "units", importRef,
          label: `unit ${room.roomCode}`,
          fieldPairs: {
            room_number: room.roomCode,
            status: room.unitStatus,
            available_date: room.availableDate,
            min_price_pcm: room.minPcm,
            max_price_pcm: room.maxPcm,
            deposit: room.deposit,
          },
          ctx: { allowSheetPrecedence: true },
        });
      } else {
        const id = randomUUID();
        unitDbId.set(room.key, id);
        const isStudio = slugify(room.roomCode) === "studio";
        const code = room.roomCode.toUpperCase();
        const values = {
          id, tenant_id: tenantId, property_id: propId,
          unit_type: isStudio ? "studio" : "room",
          room_number: room.roomCode,
          room_type: isStudio ? null : code.startsWith("ENS") ? "ensuite" : code.includes("MASTER") ? "master" : null,
          status: room.unitStatus ?? "available",
          available_date: room.availableDate,
          min_price_pcm: room.minPcm, max_price_pcm: room.maxPcm, deposit: room.deposit,
          furnishings: "furnished",
        };
        if (system.importRefReady) values.import_ref = importRef;
        addOp({ kind: "insert", table: "units", id, values, label: `create unit ${room.roomCode} (${room.propertyKey})` });
        bucket.creates.push({ key: room.key, label: room.roomCode, id, values });
      }
    }
    const knownPropIds = new Set(propertyDbId.values());
    for (const u of system.units) {
      if (!matchedDbIds.units.has(u.id) && knownPropIds.has(u.property_id)) {
        const prop = system.properties.find((p) => p.id === u.property_id);
        bucket.systemOnly.push({ dbId: u.id, label: `unit "${u.room_number}" of "${prop?.name}" — in system, not in sheet; untouched` });
      }
    }
  }

  // ---- pm_tenants ------------------------------------------------------------
  const tenantDbId = new Map();
  const tenantDbRowByKey = new Map();
  {
    const bucket = (result.pmTenants = { creates: [], updates: [], unchanged: [], systemOnly: [], review: [] });
    const dbPhones = new Map(); // e164 -> rows
    for (const r of system.pmTenants) {
      const e = e164OrNull(r.phone);
      if (e) dbPhones.set(e, [...(dbPhones.get(e) ?? []), r]);
    }
    for (const t of graph.tenants) {
      const importRef = t.key;
      let dbRow = system.importRefReady ? system.pmTenants.find((r) => r.import_ref === importRef) : null;
      let matchBasis = dbRow ? "import_ref" : null;
      if (!dbRow && t.email) {
        const hits = system.pmTenants.filter((r) => !matchedDbIds.pmTenants.has(r.id) && !blankish(r.email) && r.email.trim().toLowerCase() === t.email);
        if (hits.length === 1) { dbRow = hits[0]; matchBasis = "email"; }
        else if (hits.length > 1) {
          addReview({ entityType: "pm_tenant", key: t.key, label: t.fullName, sheetRow: t.sheetRows[0], reason: `email ${t.email} matches ${hits.length} DB tenants — skipped` });
          bucket.review.push({ key: t.key });
          continue;
        }
      }
      if (!dbRow && t.phone?.startsWith("+")) {
        const hits = (dbPhones.get(t.phone) ?? []).filter((r) => !matchedDbIds.pmTenants.has(r.id));
        if (hits.length === 1) { dbRow = hits[0]; matchBasis = "phone"; }
        else if (hits.length > 1) {
          addReview({ entityType: "pm_tenant", key: t.key, label: t.fullName, sheetRow: t.sheetRows[0], reason: `phone ${t.phone} matches ${hits.length} DB tenants — skipped` });
          bucket.review.push({ key: t.key });
          continue;
        }
      }
      if (!dbRow) {
        const nameHits = system.pmTenants.filter((r) => !matchedDbIds.pmTenants.has(r.id) && slugify(r.full_name) === slugify(t.fullName));
        if (nameHits.length === 1) {
          const r = nameHits[0];
          if (t.dob && r.date_of_birth && t.dob !== r.date_of_birth) {
            addReview({ entityType: "pm_tenant", key: t.key, label: t.fullName, sheetRow: t.sheetRows[0], dbId: r.id, reason: `name matches DB tenant but DOB differs (${r.date_of_birth} vs ${t.dob}) — skipped` });
            bucket.review.push({ key: t.key });
            continue;
          }
          dbRow = r; matchBasis = t.dob && r.date_of_birth ? "name+dob" : "name";
        } else if (nameHits.length > 1) {
          addReview({ entityType: "pm_tenant", key: t.key, label: t.fullName, sheetRow: t.sheetRows[0], reason: `name matches ${nameHits.length} DB tenants and no email/phone tiebreak — skipped` });
          bucket.review.push({ key: t.key });
          continue;
        }
      }
      if (dbRow) {
        matchedDbIds.pmTenants.add(dbRow.id);
        tenantDbId.set(t.key, dbRow.id);
        tenantDbRowByKey.set(t.key, dbRow);
        // Identity guard: the sheet row may carry the OCCUPANT's name while the
        // email/phone matched the account holder (e.g. sheet "Ben" vs DB
        // "Maisie Sheree Boardman"). Writing the occupant's DOB/phone onto the
        // account holder's record would corrupt it — suspend those fills.
        const dbSlug = slugify(dbRow.full_name), tSlug = slugify(t.fullName);
        const identityMismatch = dbSlug !== tSlug && !dbSlug.includes(tSlug) && !tSlug.includes(dbSlug);
        if (identityMismatch) {
          addReview({
            entityType: "pm_tenant", key: t.key, label: `tenant "${t.fullName}"`, sheetRow: t.sheetRows[0], dbId: dbRow.id,
            reason: `sheet name "${t.fullName}" differs from matched DB person "${dbRow.full_name}" (matched by ${matchBasis}) — ` +
              `contact/DOB fills suspended (sheet values: phone ${t.phone ?? "—"}, dob ${t.dob ?? "—"}, nationality ${t.nationality ?? "—"})`,
          });
        }
        classify(bucket, "pm_tenant", {
          key: t.key, sheetRow: t.sheetRows[0], dbRow, table: "pm_tenants", importRef,
          label: `tenant "${t.fullName}" (matched by ${matchBasis})`,
          fieldPairs: identityMismatch
            ? { full_name: t.fullName, email: t.email }
            : {
                full_name: t.fullName,
                email: t.email,
                phone: t.phone,
                whatsapp_number: t.whatsapp,
                date_of_birth: t.dob,
                nationality: t.nationality,
              },
          ctx: {},
        });
      } else {
        const id = randomUUID();
        tenantDbId.set(t.key, id);
        const values = {
          id, tenant_id: tenantId,
          full_name: t.fullName,
          email: t.email ?? UNKNOWN_CONTACT,
          phone: t.phone ?? UNKNOWN_CONTACT,
          whatsapp_number: t.whatsapp,
          date_of_birth: t.dob,
          nationality: t.nationality,
          notes: `Imported from PORTFOLIO AVAILIABILITY.xlsx (rows ${t.sheetRows.join(", ")}); raw name "${t.rawName}"`,
        };
        if (system.importRefReady) values.import_ref = importRef;
        addOp({ kind: "insert", table: "pm_tenants", id, values, label: `create tenant "${t.fullName}"` });
        bucket.creates.push({ key: t.key, label: t.fullName, id, values });
      }
    }
    for (const r of system.pmTenants) {
      if (!matchedDbIds.pmTenants.has(r.id)) bucket.systemOnly.push({ dbId: r.id, label: `tenant "${r.full_name}" — in system, not in sheet; untouched` });
    }
  }

  // ---- contracts (tenancies with an extracted start date) ----------------------
  {
    const bucket = (result.contracts = { creates: [], updates: [], unchanged: [], systemOnly: [], review: [], manual: [] });

    // Rooms with multiple identified tenancies (e.g. Trundley Road D1) are a
    // turnover/queue situation — review, never auto-create.
    const byRoom = new Map();
    for (const ty of graph.tenancies.filter((x) => !x.needsTenant)) {
      byRoom.set(ty.roomKey, [...(byRoom.get(ty.roomKey) ?? []), ty]);
    }

    for (const ty of graph.tenancies) {
      const label = `${ty.roomKey} ← ${ty.tenantKey ?? "(no tenant)"}`;
      if (ty.needsTenant) {
        bucket.manual.push({ key: ty.key, sheetRow: ty.sheetRow, reason: "needs_tenant — no tenant identity in sheet" });
        continue;
      }
      if ((byRoom.get(ty.roomKey) ?? []).length > 1) {
        addReview({
          entityType: "contract", key: ty.key, label, sheetRow: ty.sheetRow,
          reason: "multiple tenancies on one room in the sheet (turnover/queued relet) — resolve manually (Q9)",
        });
        bucket.review.push({ key: ty.key, sheetRow: ty.sheetRow });
        continue;
      }
      if (!ty.startDate) {
        bucket.manual.push({ key: ty.key, sheetRow: ty.sheetRow, reason: "no confidently-extracted start date (see contract extraction section)" });
        continue;
      }
      const unitId = unitDbId.get(ty.roomKey);
      const pmTenantId = tenantDbId.get(ty.tenantKey);
      if (!unitId || !pmTenantId) {
        addReview({ entityType: "contract", key: ty.key, label, sheetRow: ty.sheetRow, reason: "unit or tenant unresolved (see their review entries) — contract skipped" });
        bucket.review.push({ key: ty.key, sheetRow: ty.sheetRow });
        continue;
      }

      // Tenant turnover guard: unit already linked to a DIFFERENT tenant in DB.
      const dbUnit = unitDbRow.get(ty.roomKey);
      if (dbUnit?.pm_tenant_id && dbUnit.pm_tenant_id !== pmTenantId) {
        const current = system.pmTenants.find((r) => r.id === dbUnit.pm_tenant_id);
        addReview({
          entityType: "contract", key: ty.key, label, sheetRow: ty.sheetRow, dbId: dbUnit.id,
          reason: `sheet shows a different tenant than the system (system: "${current?.full_name ?? dbUnit.pm_tenant_id}") — turnover flagged for review (Q9), contract not created`,
        });
        bucket.review.push({ key: ty.key, sheetRow: ty.sheetRow });
        continue;
      }

      const importRef = `ct:${ty.roomKey}:${ty.tenantKey}`;
      let dbRow = system.importRefReady ? system.contracts.find((r) => r.import_ref === importRef) : null;
      if (!dbRow) {
        const hits = system.contracts.filter((r) => !matchedDbIds.contracts.has(r.id) && r.unit_id === unitId && r.pm_tenant_id === pmTenantId);
        if (hits.length === 1) dbRow = hits[0];
        else if (hits.length > 1) {
          addReview({ entityType: "contract", key: ty.key, label, sheetRow: ty.sheetRow, reason: `${hits.length} existing contracts for this unit+tenant — skipped` });
          bucket.review.push({ key: ty.key });
          continue;
        }
      }

      if (ty.rentPcm == null) {
        bucket.manual.push({ key: ty.key, sheetRow: ty.sheetRow, reason: "no parseable PCM — contract cannot be created (rent_pcm is NOT NULL)" });
        continue;
      }

      const rolling = ty.rolling;
      const endDate = rolling ? null : ty.endDate ?? null;
      let expiry = endDate && endDate >= ty.startDate ? endDate : null;
      if (endDate && endDate < ty.startDate) {
        addReview({ entityType: "contract", key: ty.key, label, sheetRow: ty.sheetRow, reason: `sheet end date ${endDate} predates contract start ${ty.startDate} — expiry left null` });
      }
      // The DB check requires expiry >= start_date — when updating a matched
      // contract whose start differs from the sheet's, don't propose a violating expiry.
      if (expiry && dbRow?.start_date && expiry < dbRow.start_date) expiry = null;

      let status;
      if (ty.startDate > today) status = "signed";
      else if (endDate && endDate < today) {
        if (!dbRow) {
          addReview({
            entityType: "contract", key: ty.key, label, sheetRow: ty.sheetRow,
            reason: `tenancy already ended (${endDate} < today) — historical contract not auto-created`,
          });
          bucket.review.push({ key: ty.key, sheetRow: ty.sheetRow });
          continue;
        }
        status = null; // matched historical contract — keep the system's status, compare other fields only
      } else status = "active";

      // Single-active invariant: never create a second live contract on a unit.
      if (!dbRow && status === "active") {
        const live = system.contracts.find((r) => r.unit_id === unitId && ["active", "notice_given"].includes(r.status));
        if (live) {
          addReview({
            entityType: "contract", key: ty.key, label, sheetRow: ty.sheetRow, dbId: live.id,
            reason: `unit already has a live contract in the system (${live.status}, started ${live.start_date}) for a different tenant — not created, resolve manually`,
          });
          bucket.review.push({ key: ty.key, sheetRow: ty.sheetRow });
          continue;
        }
      }

      if (dbRow) {
        matchedDbIds.contracts.add(dbRow.id);
        classify(bucket, "contract", {
          key: ty.key, sheetRow: ty.sheetRow, dbRow, table: "property_contracts", importRef,
          label: `contract ${label}`,
          fieldPairs: {
            start_date: ty.startDate,
            rent_pcm: ty.rentPcm,
            deposit: ty.deposit,
            expiry_date: expiry,
            status,
          },
          ctx: {},
        });
        // Repair an interrupted earlier run: live contract whose unit was
        // never mirrored (pm_tenant link / occupied status).
        if (["active", "notice_given"].includes(dbRow.status) && dbUnit && !dbUnit.pm_tenant_id) {
          const mirror = { pm_tenant_id: pmTenantId };
          if (dbUnit.status === "available") mirror.status = "occupied";
          addOp({ kind: "update", table: "units", id: dbUnit.id, values: mirror, label: `mirror live contract onto unit ${dbUnit.room_number}` });
        }
      } else {
        const id = randomUUID();
        const values = {
          id, tenant_id: tenantId, unit_id: unitId, pm_tenant_id: pmTenantId,
          start_date: ty.startDate, rent_pcm: ty.rentPcm, deposit: ty.deposit,
          deposit_scheme: "none",
          deposit_protection_deadline: addDays(ty.startDate, 30),
          status, expiry_date: expiry,
          notes: `Imported from PORTFOLIO AVAILIABILITY.xlsx row ${ty.sheetRow}; start date from ${ty.startDateSource}`,
        };
        if (system.importRefReady) values.import_ref = importRef;
        const op = addOp({
          kind: "insert", table: "property_contracts", id, values,
          label: `create ${status} contract ${label} from ${ty.startDate}`,
          attachment: ty.contract?.driveFileId && ty.contractLocalPath
            ? { bucket: "property_contracts", driveFileId: ty.contract.driveFileId, fileRef: ty.contract.fileRef, localPath: ty.contractLocalPath, storagePath: `${tenantId}/import/${slugify(importRef)}.pdf`, urlColumn: "document_url" }
            : null,
        });
        bucket.creates.push({ key: ty.key, label, id, values, opSeq: op.seq });

        // Mirror onto the unit what contract activation does in the app.
        if (status === "active") {
          const mirror = {};
          if (!dbUnit?.pm_tenant_id) mirror.pm_tenant_id = pmTenantId;
          if (dbUnit && dbUnit.status === "available") mirror.status = "occupied";
          if (Object.keys(mirror).length && dbUnit) {
            addOp({ kind: "update", table: "units", id: dbUnit.id, values: mirror, label: `mirror active contract onto unit ${dbUnit.room_number}` });
          } else if (!dbUnit) {
            // unit is being created in this run — patch the pending insert
            const unitOp = ops.find((o) => o.kind === "insert" && o.table === "units" && o.id === unitId);
            if (unitOp) {
              unitOp.values.pm_tenant_id = pmTenantId;
              unitOp.values.status = "occupied";
            }
          }
        }
      }
    }
    for (const r of system.contracts) {
      if (!matchedDbIds.contracts.has(r.id)) bucket.systemOnly.push({ dbId: r.id, label: `contract ${r.id} (status ${r.status}) — in system, not produced by sheet; untouched` });
    }
  }

  // ---- keys (keybox codes) -----------------------------------------------------
  {
    const bucket = (result.keys = { creates: [], updates: [], unchanged: [], systemOnly: [], review: [] });
    const seenKeyProps = new Set();
    for (const k of graph.keys) {
      if (k.noKeybox) continue;
      let propId = k.propertyKey ? propertyDbId.get(k.propertyKey) : null;
      if (!propId) {
        // Property absent from the portfolio tab (e.g. "37 Balman House") —
        // fall back to matching the keybox address against system properties.
        const addrSlug = slugify(k.address);
        const hits = system.properties.filter((r) => {
          const dbSlug = slugify(r.name);
          return dbSlug === addrSlug || addrSlug.includes(dbSlug) || dbSlug.includes(addrSlug) ||
            fuzzyNameMatch(stripHouseNo(r.name), stripHouseNo(k.address));
        });
        if (hits.length === 1) {
          propId = hits[0].id;
          addReview({
            entityType: "key", key: k.key, label: k.address, sheetRow: k.sheetRow,
            reason: `keybox property "${k.address}" not in the portfolio tab — matched system property "${hits[0].name}", verify`,
          });
        }
      }
      if (!propId) {
        addReview({ entityType: "key", key: k.key, label: k.address, sheetRow: k.sheetRow, reason: "keybox address matched no property (sheet or system) — key skipped" });
        bucket.review.push({ key: k.key, label: k.address, reason: "property unresolved" });
        continue;
      }
      if (seenKeyProps.has(propId)) {
        addReview({ entityType: "key", key: k.key, label: k.address, sheetRow: k.sheetRow, reason: `a second keybox row resolved to the same property — skipped, resolve manually` });
        bucket.review.push({ key: k.key, label: k.address });
        continue;
      }
      seenKeyProps.add(propId);

      const importRef = k.key;
      let dbRow = system.importRefReady ? system.keys.find((r) => r.import_ref === importRef) : null;
      if (!dbRow) {
        const hits = system.keys.filter((r) => !matchedDbIds.keys.has(r.id) && r.property_id === propId && r.set_name === KEY_ROW.set_name);
        if (hits.length === 1) dbRow = hits[0];
        else if (hits.length > 1) {
          // Ambiguous matches are never auto-merged.
          addReview({ entityType: "key", key: k.key, label: k.address, sheetRow: k.sheetRow, reason: `${hits.length} Keybox rows for this property in DB — ambiguous, skipped` });
          bucket.review.push({ key: k.key, label: k.address });
          continue;
        }
      }
      if (dbRow) {
        matchedDbIds.keys.add(dbRow.id);
        classify(bucket, "key", {
          key: k.key, sheetRow: k.sheetRow, dbRow, table: "keys", importRef,
          label: `keybox "${k.address}"`,
          fieldPairs: { notes: k.code },
          ctx: {},
        });
      } else {
        const id = randomUUID();
        const values = {
          id, tenant_id: tenantId, property_id: propId,
          set_name: KEY_ROW.set_name, copy_label: KEY_ROW.copy_label, status: KEY_ROW.status,
          notes: k.code,
        };
        if (system.importRefReady) values.import_ref = importRef;
        addOp({ kind: "insert", table: "keys", id, values, label: `create keybox code for "${k.address}"` });
        bucket.creates.push({ key: k.key, label: k.address, id });
      }
    }
    for (const r of system.keys) {
      if (!matchedDbIds.keys.has(r.id) && r.set_name === KEY_ROW.set_name) {
        bucket.systemOnly.push({ dbId: r.id, label: `keybox key ${r.id} — in system, not in sheet; untouched` });
      }
    }
  }

  // ---- portfolio bank details ----------------------------------------------------
  {
    const bucket = (result.bankDetails = { creates: [], updates: [], unchanged: [], systemOnly: [], review: [] });
    const digits = (s) => String(s ?? "").replace(/\D/g, "");
    for (const b of graph.bankDetails) {
      const portfolioId = graph.portfolioIds[b.company];
      const candidates = system.bankDetails.filter((r) => r.portfolio_id === portfolioId && !matchedDbIds.bankDetails.has(r.id));
      let dbRow = candidates.find((r) => digits(r.sort_code) === digits(b.sortCode) && digits(r.account_number) === digits(b.accountNumber))
        ?? candidates.find((r) => digits(r.sort_code) === digits(b.sortCode))
        ?? candidates.find((r) => fuzzyNameMatch(r.label ?? "", b.label));
      if (dbRow) {
        matchedDbIds.bankDetails.add(dbRow.id);
        const { autoFields, conflicts } = diffFields({
          label: b.label,
          account_holder_name: b.accountHolderName,
          sort_code: b.sortCode,
          account_number: b.accountNumber,
          payment_reference_hint: b.referenceHint,
        }, dbRow, {});
        for (const c of conflicts) {
          addReview({ entityType: "bank_details", key: b.key, label: `${b.company} ${b.label}`, dbId: dbRow.id, field: c.field, before: c.before, after: c.after, reason: "bank detail differs — reported, not applied" });
        }
        if (Object.keys(autoFields).length) {
          addOp({ kind: "update", table: "portfolio_bank_details", id: dbRow.id, values: autoFields, label: `update bank details ${b.company}/${b.label}` });
          bucket.updates.push({ key: b.key, dbId: dbRow.id, fields: autoFields, conflicts });
        } else if (conflicts.length) bucket.updates.push({ key: b.key, dbId: dbRow.id, fields: {}, conflicts });
        else bucket.unchanged.push({ key: b.key, dbId: dbRow.id });
      } else {
        const id = randomUUID();
        const hasDefault = system.bankDetails.some((r) => r.portfolio_id === portfolioId && r.is_default);
        addOp({
          kind: "insert", table: "portfolio_bank_details", id,
          values: {
            id, tenant_id: tenantId, portfolio_id: portfolioId, label: b.label,
            account_holder_name: b.accountHolderName, sort_code: b.sortCode,
            account_number: b.accountNumber, payment_reference_hint: b.referenceHint,
            is_default: b.isDefault && !hasDefault,
          },
          label: `create bank details ${b.company}/${b.label}`,
        });
        bucket.creates.push({ key: b.key, label: `${b.company} ${b.label}`, id });
      }
    }
    for (const r of system.bankDetails) {
      if (!matchedDbIds.bankDetails.has(r.id)) bucket.systemOnly.push({ dbId: r.id, label: `bank details "${r.label}" — in system, not in sheet; untouched` });
    }
  }

  // FK-safe execution order regardless of emission order (e.g. a pending unit
  // insert patched with the id of a pm_tenant inserted in a later stage).
  const TABLE_ORDER = { portfolios: 1, properties: 2, pm_tenants: 3, units: 4, property_contracts: 5, keys: 6, portfolio_bank_details: 7 };
  ops.sort((a, b) => (TABLE_ORDER[a.table] ?? 99) - (TABLE_ORDER[b.table] ?? 99) || a.seq - b.seq);

  const summary = {};
  for (const [k, v] of Object.entries(result)) {
    summary[k] = {
      creates: v.creates.length, updates: v.updates.filter((u) => Object.keys(u.fields ?? {}).length).length,
      conflictsReported: v.updates.reduce((n, u) => n + (u.conflicts?.length ?? 0), 0),
      unchanged: v.unchanged.length, systemOnly: v.systemOnly.length,
      review: (v.review ?? []).length, manual: (v.manual ?? []).length,
    };
  }

  return { precedence, importRefReady: system.importRefReady, tenantId, entities: result, ops, review, summary };
}
