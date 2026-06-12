// Stage 2: normalize parsed rows into an entity graph
// (properties -> rooms -> tenancies -> tenants, plus keys and bank details)
// and collect every fix/warning/blocker with sheet row references.

import {
  AREA_MAP, PROPERTY_AREA, PROPERTY_NAME_MAP, PROPERTY_POSTCODE, PROPERTY_HEAD_ADDRESS,
  PROPERTY_DB_ALIASES, EMAIL_FIX_MAP, SUSPECT_EMAIL_DOMAIN_RE, FOREIGN_DIAL_CODES,
  DOB_MIN_AGE, DOB_MAX_AGE,
  KEYBOX_ADDRESS_MAP, NO_KEYBOX_VALUES, UNKNOWN_CONTACT, unitStatusFor, depositFor, PORTFOLIOS,
} from "../config.mjs";
import {
  normSpace, normPostcode, slugify, titleCaseName, parseDmy, parseDMonY,
  parseMoney, fuzzyNameMatch, todayIso, yearsBetween,
} from "./util.mjs";

// ---------------------------------------------------------------------------
// Field extractors (exported for selftest)
// ---------------------------------------------------------------------------

// Available column -> { status, endDate, relet, raw } | null
export function extractAvailability(cell) {
  if (!cell) return null;
  const raw = cell.text;
  if (cell.iso) return { status: "DATE", endDate: cell.iso, relet: false, marketed: false, raw };

  const s = normSpace(raw).toUpperCase();
  if (/^NOW[\s\-_(]*BOOKED[)\s]*$/.test(s)) return { status: "NOW", endDate: null, relet: true, marketed: false, raw };
  if (s === "NOW") return { status: "NOW", endDate: null, relet: false, marketed: false, raw };
  if (s === "BOOKED") return { status: "BOOKED", endDate: null, relet: false, marketed: false, raw };
  if (s === "ROLLING") return { status: "ROLLING", endDate: null, relet: false, marketed: false, raw };
  if (s === "TBC") return { status: "TBC", endDate: null, relet: false, marketed: false, raw };

  // Tolerant: optional "D MMM YYYY" date + optional suffix token, any separators.
  const m = s.match(/^(\d{1,2}\s+[A-Z]{3,9}\.?\s+\d{4})\s*[-(\s]*\(?\s*(BOOKED|AVAILABLE|RENEW)?\s*\)?\s*$/);
  if (m) {
    const endDate = parseDMonY(m[1]);
    if (!endDate) return null;
    const suffix = m[2] ?? null;
    if (suffix === "RENEW") return { status: "RENEW", endDate, relet: false, marketed: false, raw };
    return { status: "DATE", endDate, relet: suffix === "BOOKED", marketed: suffix === "AVAILABLE", raw };
  }
  return null;
}

const DATE_SHAPED_RE = /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/;

// One phone part -> { e164 | null, confident }
function normalizePhonePart(part) {
  const digitsPlus = part.replace(/[^\d+]/g, "");
  const digits = digitsPlus.replace(/\+/g, "");
  if (digitsPlus.startsWith("+")) {
    return { e164: digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null, confident: true };
  }
  if (digits.startsWith("00") && digits.length >= 11) return { e164: `+${digits.slice(2)}`, confident: true };
  if (digits.startsWith("0") && digits.length === 11 && digits[1] === "7") return { e164: `+44${digits.slice(1)}`, confident: true };
  if (digits.startsWith("44") && (digits.length === 12 || digits.length === 13)) return { e164: `+${digits}`, confident: true };
  if (digits.startsWith("7") && digits.length === 10) return { e164: `+44${digits}`, confident: true }; // UK mobile missing leading 0
  for (const { code, min, max } of FOREIGN_DIAL_CODES) {
    if (digits.startsWith(code) && digits.length >= min && digits.length <= max) {
      return { e164: `+${digits}`, confident: true };
    }
  }
  return { e164: null, confident: false };
}

// Raw phone cell -> { phone, whatsapp, raw, issues: [{category, message}] }
export function normalizePhone(raw) {
  const issues = [];
  const value = normSpace(raw ?? "");
  if (!value) return { phone: null, whatsapp: null, raw: value || null, issues };
  if (DATE_SHAPED_RE.test(value)) {
    issues.push({ category: "phone_date_shaped", message: `date-shaped value "${value}" in phone column — nulled` });
    return { phone: null, whatsapp: null, raw: value, issues };
  }
  const parts = value.split("/").map((p) => normSpace(p)).filter(Boolean);
  if (parts.length > 2) issues.push({ category: "phone_multi", message: `more than two phone values in one cell: "${value}"` });

  const primary = normalizePhonePart(parts[0] ?? "");
  const secondary = parts[1] ? normalizePhonePart(parts[1]) : null;
  if (parts.length > 1) {
    issues.push({ category: "phone_multi", message: `two numbers in one cell "${value}" — first kept as phone, second as whatsapp` });
  }
  if (!primary.e164) {
    issues.push({ category: "phone_invalid", message: `cannot confidently normalize "${parts[0]}" — raw value kept` });
  }
  if (secondary && !secondary.e164) {
    issues.push({ category: "phone_invalid", message: `cannot confidently normalize secondary "${parts[1]}" — raw value kept` });
  }
  return {
    phone: primary.e164 ?? parts[0] ?? null,
    whatsapp: secondary ? (secondary.e164 ?? parts[1]) : null,
    raw: value,
    issues,
  };
}

// Raw email -> { email, raw, issues }
export function normalizeEmail(raw) {
  const issues = [];
  const value = normSpace(raw ?? "").toLowerCase();
  if (!value) return { email: null, raw: null, issues };
  let email = value;
  if (EMAIL_FIX_MAP[value]) {
    email = EMAIL_FIX_MAP[value];
    issues.push({ category: "email_fixed", message: `"${value}" -> "${email}" (config EMAIL_FIX_MAP)` });
  }
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    issues.push({ category: "email_invalid", message: `invalid email syntax "${email}"` });
    return { email: null, raw: value, issues };
  }
  if (SUSPECT_EMAIL_DOMAIN_RE.test(email)) {
    issues.push({ category: "email_suspect", message: `suspect domain ending in "${email}" — verify with tenant` });
  }
  return { email, raw: value, issues };
}

// Raw DOB -> { dob, issues }
export function normalizeDob(raw) {
  const issues = [];
  const value = normSpace(raw ?? "");
  if (!value) return { dob: null, issues };
  const dob = parseDmy(value);
  if (!dob) {
    issues.push({ category: "dob_invalid", message: `cannot parse DOB "${value}" (expected DD/MM/YYYY)` });
    return { dob: null, issues };
  }
  const age = yearsBetween(dob, todayIso());
  if (age < 0) {
    issues.push({ category: "dob_invalid", message: `DOB "${value}" is in the future — nulled, manual entry needed` });
    return { dob: null, issues };
  }
  if (age < DOB_MIN_AGE) {
    issues.push({ category: "dob_invalid", message: `DOB "${value}" implies age ${age.toFixed(1)} (< ${DOB_MIN_AGE}) — nulled, manual entry needed` });
    return { dob: null, issues };
  }
  if (age > DOB_MAX_AGE) {
    issues.push({ category: "dob_invalid", message: `DOB "${value}" implies age ${age.toFixed(0)} (> ${DOB_MAX_AGE}) — nulled, manual entry needed` });
    return { dob: null, issues };
  }
  return { dob, issues };
}

// PCM cell -> { rent, min, max, dual, issues }
export function normalizePcm(cell) {
  const issues = [];
  if (!cell) return { rent: null, min: null, max: null, dual: false, issues };
  const text = cell.text;
  if (text.includes("/")) {
    const [a, b] = text.split("/").map((p) => parseMoney(p));
    if (a != null && b != null) {
      issues.push({ category: "dual_rent", message: `dual rent "${text}" — first value £${a} used as contractual rent/deposit, range £${a}–£${b} kept on the unit` });
      return { rent: a, min: Math.min(a, b), max: Math.max(a, b), dual: true, issues };
    }
  }
  const rent = parseMoney(text);
  if (rent == null) {
    issues.push({ category: "pcm_invalid", message: `cannot parse PCM "${text}"` });
    return { rent: null, min: null, max: null, dual: false, issues };
  }
  return { rent, min: rent, max: rent, dual: false, issues };
}

// Contract cell -> classification
export function classifyContractCell(cell) {
  if (!cell) return null;
  const text = cell.text;
  const link = cell.link ?? null;
  const isPdfName = /\.pdf\s*$/i.test(text);
  const isFileLink = !!link && /\/file\/d\//.test(link);
  const fileId = isFileLink ? link.match(/\/file\/d\/([^/]+)/)?.[1] ?? null : null;
  return {
    raw: text,
    link,
    kind: isPdfName || isFileLink ? "pdf" : "address",
    fileRef: isPdfName ? text : null,
    driveFileId: fileId,
    headAddress: !isPdfName && !isFileLink ? text : null,
  };
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

function makeIssue(list, severity, category, message, sheetRow = null, tab = "Property Portfolio") {
  list.push({ severity, category, message, sheetRow, tab });
}

function canonicalPropertyName(rawName) {
  const trimmed = normSpace(rawName);
  return PROPERTY_NAME_MAP[trimmed.toLowerCase()] ?? trimmed;
}

function tenantKeyFor({ email, phone, fullName, dob }) {
  if (email) return `tn:email:${email}`;
  if (phone && phone.startsWith("+")) return `tn:phone:${phone}`;
  return `tn:name:${slugify(fullName)}:${dob ?? "nodob"}`;
}

function pickMajority(values) {
  const counts = new Map();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null, bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

export function buildGraph(parsed) {
  const issues = [];
  const properties = new Map(); // key -> property
  const rooms = new Map();      // key -> room
  const tenants = new Map();    // key -> tenant
  const tenancies = [];
  const keys = [];
  const bankDetails = [];

  for (const s of parsed.portfolio.structural) {
    makeIssue(issues, "warning", "structural", s.note, s.sheetRow ?? null);
  }
  if (parsed.missingTabs.length) {
    makeIssue(issues, "blocking", "structural", `expected tabs missing from workbook: ${parsed.missingTabs.join(", ")}`, null, "(workbook)");
  }
  for (const t of parsed.unknownTabs) {
    makeIssue(issues, "warning", "structural", `unexpected tab "${t}" — not parsed`, null, "(workbook)");
  }

  const sections = [
    { company: "ap", rows: parsed.portfolio.sections.ap },
    { company: "horizon", rows: parsed.portfolio.sections.horizon },
  ];

  // ---- pass 1: rows -> per-row records --------------------------------------
  const rowRecords = [];
  for (const { company, rows } of sections) {
    for (const row of rows) {
      const c = row.cells;
      const rawName = c.property?.text ?? null;
      const roomCode = c.room?.text ?? null;
      if (!rawName || !roomCode) {
        makeIssue(issues, "warning", "structural", `row missing ${!rawName ? "property" : "room"} — skipped`, row.sheetRow);
        continue;
      }
      const name = canonicalPropertyName(rawName);
      if (name !== rawName) {
        makeIssue(issues, "info", "name_remap", `property name "${rawName}" -> "${name}"`, row.sheetRow);
      }

      const rawArea = c.area?.text ?? null;
      let area = rawArea ? (AREA_MAP[rawArea.toLowerCase()] ?? normSpace(rawArea)) : null;
      if (rawArea && area !== rawArea) {
        makeIssue(issues, "info", "area_remap", `area "${rawArea}" -> "${area}" (config AREA_MAP)`, row.sheetRow);
      }

      const postcode = c.postcode ? normPostcode(c.postcode.text) : null;
      const availability = extractAvailability(c.available ?? null);
      if (c.available && !availability) {
        makeIssue(issues, "blocking", "availability_unparsed", `cannot parse Available value "${c.available.text}"`, row.sheetRow);
      }
      if (!c.available) {
        makeIssue(issues, "warning", "availability_missing", `Available cell empty`, row.sheetRow);
      }
      if (availability?.status === "TBC") {
        makeIssue(issues, "warning", "available_tbc", `availability is TBC`, row.sheetRow);
      }
      if (availability?.endDate && availability.endDate < todayIso()) {
        makeIssue(issues, "warning", "date_in_past", `availability end date ${availability.endDate} is in the past`, row.sheetRow);
      }

      const pcm = normalizePcm(c.pcm ?? null);
      for (const i of pcm.issues) makeIssue(issues, i.category === "pcm_invalid" ? "blocking" : "warning", i.category, i.message, row.sheetRow);

      const beds = c.beds ? Number(String(c.beds.text).replace(/[^\d.]/g, "")) || null : null;
      const baths = c.baths ? Number(String(c.baths.text).replace(/[^\d.]/g, "")) || null : null;

      const contract = classifyContractCell(c.contract ?? null);

      // Tenant fields (Horizon only; AP columns simply absent)
      const rawTenantName = c.tenantName?.text ?? null;
      let tenant = null;
      if (rawTenantName) {
        const fullName = titleCaseName(rawTenantName);
        if (fullName !== normSpace(rawTenantName)) {
          makeIssue(issues, "info", "name_casing", `tenant name "${rawTenantName}" -> "${fullName}" (raw preserved)`, row.sheetRow);
        }
        const emailN = normalizeEmail(c.email?.text ?? null);
        for (const i of emailN.issues) makeIssue(issues, i.category === "email_fixed" ? "info" : "warning", i.category, i.message, row.sheetRow);
        const phoneN = normalizePhone(c.phone?.text ?? null);
        for (const i of phoneN.issues) makeIssue(issues, "warning", i.category, i.message, row.sheetRow);
        const dobN = normalizeDob(c.dob?.text ?? null);
        for (const i of dobN.issues) makeIssue(issues, "warning", i.category, i.message, row.sheetRow);
        const nationality = c.nationality?.text ?? null;

        const missing = [
          !emailN.email && "email",
          !phoneN.phone && "phone",
          !dobN.dob && "dob",
        ].filter(Boolean);
        if (missing.length) {
          makeIssue(issues, "warning", "partial_tenant", `tenant "${fullName}" missing: ${missing.join(", ")}`, row.sheetRow);
        }

        tenant = {
          fullName,
          rawName: rawTenantName,
          email: emailN.email,
          emailRaw: emailN.raw,
          phone: phoneN.phone,
          whatsapp: phoneN.whatsapp,
          phoneRaw: phoneN.raw,
          dob: dobN.dob,
          nationality,
        };
        tenant.key = tenantKeyFor(tenant);
      }

      rowRecords.push({
        sheetRow: row.sheetRow, company, name, rawName, roomCode, area, postcode,
        availability, pcm, beds, baths, contract, tenant,
        propertyLink: c.property?.link ?? null,
      });
    }
  }

  // ---- pass 2: properties (aggregate per company+name) ----------------------
  for (const rec of rowRecords) {
    const pKey = `pp:${rec.company}:${slugify(rec.name)}`;
    if (!properties.has(pKey)) {
      properties.set(pKey, {
        key: pKey, company: rec.company, name: rec.name,
        areas: [], postcodes: [], bedsList: [], bathsList: [],
        headAddresses: [], driveFolders: [], rows: [],
      });
    }
    const p = properties.get(pKey);
    p.rows.push(rec.sheetRow);
    if (rec.area) p.areas.push({ v: rec.area, row: rec.sheetRow });
    if (rec.postcode) p.postcodes.push({ v: rec.postcode, row: rec.sheetRow });
    if (rec.beds != null) p.bedsList.push({ v: rec.beds, row: rec.sheetRow });
    if (rec.baths != null) p.bathsList.push({ v: rec.baths, row: rec.sheetRow });
    if (rec.contract?.headAddress) p.headAddresses.push({ v: rec.contract.headAddress, row: rec.sheetRow });
    if (rec.propertyLink) p.driveFolders.push({ v: rec.propertyLink, row: rec.sheetRow });
    rec.propertyKey = pKey;
  }

  for (const p of properties.values()) {
    // Area: config canonical > majority; report drift.
    const distinctAreas = [...new Set(p.areas.map((a) => a.v))];
    p.area = PROPERTY_AREA[p.name] ?? pickMajority(p.areas.map((a) => a.v));
    if (distinctAreas.length > 1) {
      makeIssue(issues, "warning", "area_conflict",
        `"${p.name}" listed under ${distinctAreas.join(" / ")} — canonicalized to "${p.area}" (rows ${p.areas.map((a) => a.row).join(", ")})`, p.rows[0]);
    }

    // Postcode: config canonical > majority; flag conflicts and missing rows.
    const distinctPcs = [...new Set(p.postcodes.map((a) => a.v))];
    p.postcode = PROPERTY_POSTCODE[p.name] ? normPostcode(PROPERTY_POSTCODE[p.name]) : pickMajority(p.postcodes.map((a) => a.v));
    if (distinctPcs.length > 1) {
      makeIssue(issues, "warning", "postcode_conflict",
        `"${p.name}" carries postcodes ${distinctPcs.join(" / ")} — canonicalized to ${p.postcode}`, p.rows[0]);
    }
    if (!p.postcode) {
      makeIssue(issues, "blocking", "postcode_missing", `"${p.name}" has no postcode on any row`, p.rows[0]);
    }

    // Beds/baths: first value per property, flag disagreements.
    p.beds = p.bedsList[0]?.v ?? null;
    p.baths = p.bathsList[0]?.v ?? null;
    const bedsConflicts = p.bedsList.filter((b) => b.v !== p.beds);
    const bathsConflicts = p.bathsList.filter((b) => b.v !== p.baths);
    for (const b of bedsConflicts) makeIssue(issues, "warning", "beds_baths_conflict", `"${p.name}" beds ${b.v} differs from first value ${p.beds}`, b.row);
    for (const b of bathsConflicts) makeIssue(issues, "warning", "beds_baths_conflict", `"${p.name}" baths ${b.v} differs from first value ${p.baths}`, b.row);
    // System convention: fractional baths -> round up + separate_wc.
    p.totalBathrooms = p.baths != null ? Math.ceil(p.baths) : null;
    p.separateWc = p.baths != null ? p.baths % 1 !== 0 : false;

    // Head address (legal address line): Contract column address > config > name.
    const headAddr = pickMajority(p.headAddresses.map((a) => a.v)) ?? PROPERTY_HEAD_ADDRESS[p.name] ?? null;
    const distinctAddrs = [...new Set(p.headAddresses.map((a) => normSpace(a.v)))];
    if (distinctAddrs.length > 1) {
      makeIssue(issues, "warning", "head_address_conflict", `"${p.name}" head addresses differ: ${distinctAddrs.join(" | ")} — majority kept`, p.rows[0]);
    }
    p.addressLine1 = headAddr ?? p.name;
    if (headAddr && !fuzzyNameMatch(headAddr.replace(/^\d+\w*\s+/, "").replace(/,.*$/, ""), p.name)) {
      makeIssue(issues, "info", "name_vs_address", `"${p.name}" display name kept; legal address line is "${headAddr}"`, p.rows[0]);
    }

    p.driveFolderUrl = pickMajority(p.driveFolders.map((a) => a.v));
    const distinctFolders = [...new Set(p.driveFolders.map((a) => a.v))];
    if (distinctFolders.length > 1) {
      makeIssue(issues, "warning", "drive_folder_conflict", `"${p.name}" rows link to ${distinctFolders.length} different Drive folders — majority kept, verify images source`, p.rows[0]);
    }
    delete p.areas; delete p.postcodes; delete p.bedsList; delete p.bathsList;
    delete p.headAddresses; delete p.driveFolders;
  }

  // Rows whose postcode was missing but property has one: report inheritance.
  for (const rec of rowRecords) {
    if (!rec.postcode && properties.get(rec.propertyKey).postcode) {
      makeIssue(issues, "warning", "postcode_missing",
        `row has no postcode — inherited ${properties.get(rec.propertyKey).postcode} from sibling rows of "${rec.name}"`, rec.sheetRow);
    }
  }

  // ---- pass 3: rooms + tenants + tenancies ----------------------------------
  for (const rec of rowRecords) {
    const rKey = `${rec.propertyKey}:room:${slugify(rec.roomCode)}`;
    const a = rec.availability;
    const unitStatus = a ? unitStatusFor(a) : null;

    if (rooms.has(rKey)) {
      const existing = rooms.get(rKey);
      makeIssue(issues, "review", "duplicate_room",
        `room "${rec.roomCode}" of "${rec.name}" appears twice (rows ${existing.sheetRow} and ${rec.sheetRow}) with ` +
        `end dates ${existing.endDate ?? "—"} vs ${a?.endDate ?? "—"} — one unit kept; both tenancies recorded for review`, rec.sheetRow);
    } else {
      rooms.set(rKey, {
        key: rKey, propertyKey: rec.propertyKey, roomCode: rec.roomCode,
        unitStatus, availableDate: a?.endDate ?? null,
        rentPcm: rec.pcm.rent, minPcm: rec.pcm.min, maxPcm: rec.pcm.max,
        deposit: rec.pcm.rent != null ? depositFor(rec.pcm.rent) : null,
        availabilityRaw: a?.raw ?? null, sheetRow: rec.sheetRow,
      });
    }

    // Tenants: dedupe by key across rows.
    let tenantKey = null;
    if (rec.tenant) {
      tenantKey = rec.tenant.key;
      if (!tenants.has(tenantKey)) {
        tenants.set(tenantKey, { ...rec.tenant, sheetRows: [rec.sheetRow] });
      } else {
        tenants.get(tenantKey).sheetRows.push(rec.sheetRow);
      }
    }

    // Tenancy: named tenant -> full tenancy; occupied-ish room without tenant -> stub.
    const occupiedish = a && (a.status === "ROLLING" || a.status === "BOOKED" || a.status === "RENEW" ||
      a.status === "DATE" || (a.status === "NOW" && a.relet));
    if (rec.tenant) {
      tenancies.push({
        key: `ct:${rKey}:${tenantKey}`,
        roomKey: rKey, tenantKey, sheetRow: rec.sheetRow,
        company: rec.company,
        rentPcm: rec.pcm.rent,
        deposit: rec.pcm.rent != null ? depositFor(rec.pcm.rent) : null,
        endDate: a?.endDate ?? null,
        rolling: a?.status === "ROLLING",
        relet: a?.relet ?? false,
        availabilityRaw: a?.raw ?? null,
        contract: rec.contract,
        startDate: null, // stage 3 fills from the signed PDF
        needsTenant: false,
      });
    } else if (occupiedish) {
      tenancies.push({
        key: `ct:${rKey}:needs-tenant`,
        roomKey: rKey, tenantKey: null, sheetRow: rec.sheetRow,
        company: rec.company,
        rentPcm: rec.pcm.rent,
        deposit: rec.pcm.rent != null ? depositFor(rec.pcm.rent) : null,
        endDate: a?.endDate ?? null,
        rolling: a?.status === "ROLLING",
        relet: a?.relet ?? false,
        availabilityRaw: a?.raw ?? null,
        contract: rec.contract,
        startDate: null,
        needsTenant: true,
      });
      makeIssue(issues, "warning", "needs_tenant",
        `room "${rec.roomCode}" of "${rec.name}" is ${a.raw} but has no tenant identity — tenancy on manual entry list`, rec.sheetRow);
    }

    if (rec.tenant && rec.company === "horizon" && rec.tenant.nationality) {
      // Nationality imported as freetext; flag obvious non-nationality values for the report only.
      if (/^(zimbabwe|canada|frence)$/i.test(rec.tenant.nationality)) {
        makeIssue(issues, "info", "nationality_freetext",
          `nationality "${rec.tenant.nationality}" is a country name or typo — imported as freetext`, rec.sheetRow);
      }
    }
  }

  // ---- keybox tab -> keys ----------------------------------------------------
  for (const s of parsed.keybox.structural ?? []) {
    makeIssue(issues, "warning", "structural", s.note, s.sheetRow ?? null, "Keybox Codes");
  }
  const propsByCompany = { ap: [], horizon: [] };
  for (const p of properties.values()) propsByCompany[p.company].push(p);

  for (const row of parsed.keybox.rows) {
    const noKeybox = NO_KEYBOX_VALUES.has(row.code.toUpperCase());
    const mapped = KEYBOX_ADDRESS_MAP[row.address.toLowerCase().trim()];
    let property = null;
    if (mapped === null) {
      makeIssue(issues, "review", "unknown_property",
        `keybox address "${row.address}" has no matching property in the Property Portfolio tab`, row.sheetRow, "Keybox Codes");
    } else {
      const nameToMatch = mapped ?? row.address.replace(/^\d+\w*\s+/, "");
      const candidates = (propsByCompany[row.company] ?? []).filter((p) => {
        if (fuzzyNameMatch(nameToMatch, p.name)) return true;
        // The keybox tab uses legal addresses; bridge via the DB alias
        // ("7 Chargrove Close" -> alias of "Chargrove Pl").
        const alias = PROPERTY_DB_ALIASES[p.name];
        return alias != null && fuzzyNameMatch(nameToMatch, alias.replace(/^\d+\w*\s+/, ""));
      });
      if (candidates.length === 1) {
        property = candidates[0];
      } else if (candidates.length > 1) {
        candidates.sort((a, b) => a.name.localeCompare(b.name));
        property = candidates[0];
        makeIssue(issues, "review", "ambiguous_keybox",
          `keybox address "${row.address}" matches ${candidates.map((c) => `"${c.name}"`).join(", ")} — attached to "${property.name}"`, row.sheetRow, "Keybox Codes");
      } else {
        makeIssue(issues, "review", "unknown_property",
          `keybox address "${row.address}" matched no property`, row.sheetRow, "Keybox Codes");
      }
    }
    keys.push({
      // Address slug keeps the ref unique even if two keybox rows resolve to one property.
      key: property ? `key:${property.key}:${slugify(row.address)}` : `key:unmatched:${slugify(row.address)}`,
      propertyKey: property?.key ?? null,
      address: row.address, code: row.code, company: row.company,
      noKeybox, sheetRow: row.sheetRow,
    });
    if (noKeybox) {
      makeIssue(issues, "info", "no_keybox", `"${row.address}" has no keybox installed (code "${row.code}")`, row.sheetRow, "Keybox Codes");
    }
  }

  // ---- agent info tab -> portfolio bank details ------------------------------
  for (const [company, section] of Object.entries(parsed.agentInfo.sections ?? {})) {
    let first = true;
    for (const bank of section.bank) {
      const f = bank.fields;
      const iban = f["IBAN"] ?? null;
      let accountNumber = f["Account Number"] ?? null;
      if (accountNumber && iban && iban.length >= 8) {
        const fromIban = iban.slice(-8);
        if (fromIban !== accountNumber && fromIban.endsWith(accountNumber)) {
          makeIssue(issues, "warning", "account_number_short",
            `${company} ${bank.bank}: account number "${accountNumber}" missing leading zero(s); corrected to "${fromIban}" from IBAN`, null, "Agent Info");
          accountNumber = fromIban;
        }
      }
      bankDetails.push({
        key: `bank:${company}:${slugify(bank.bank)}`,
        company,
        label: bank.bank,
        accountHolderName: f["Account Name"] ?? null,
        sortCode: f["Sort Code"] ?? null,
        accountNumber,
        referenceHint: f["Reference"] ?? null,
        isDefault: first,
      });
      first = false;
    }
    for (const l of section.links) {
      makeIssue(issues, "info", "agent_info_link",
        `${company}: ${l.label ?? "link"} = ${l.value}${l.link ? ` (${l.link})` : ""} — no Harbor Ops home for reference-form links; recorded for review`, null, "Agent Info");
    }
  }

  const graph = {
    generatedFrom: parsed.file,
    properties: [...properties.values()],
    rooms: [...rooms.values()],
    tenants: [...tenants.values()],
    tenancies,
    keys,
    bankDetails,
    issues,
    counts: {
      properties: properties.size,
      rooms: rooms.size,
      tenants: tenants.size,
      tenancies: tenancies.length,
      tenanciesNeedingTenant: tenancies.filter((t) => t.needsTenant).length,
      keys: keys.length,
      bankDetails: bankDetails.length,
      issues: issues.length,
      blocking: issues.filter((i) => i.severity === "blocking").length,
    },
  };
  return graph;
}
