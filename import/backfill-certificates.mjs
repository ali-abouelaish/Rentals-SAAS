// Backfill AP Real Estate's existing compliance certificates from a CSV.
//
//   node --env-file=.env.local import/backfill-certificates.mjs             # dry run
//   node --env-file=.env.local import/backfill-certificates.mjs --commit    # apply
//   node --env-file=.env.local import/backfill-certificates.mjs --csv import/source/certificates.csv
//
// Source: import/source/certificates.csv (see certificates.template.csv for
// the columns — the portfolio workbook carries no certificate data, so this
// sheet is filled in by AP by hand or exported from their records).
//
// Rules:
// - Properties are matched by name (case-insensitive) with PROPERTY_DB_ALIASES
//   fallback; unknown properties are blocking issues.
// - `unit` is an optional room number matched within the property.
// - `contractor` is matched in maintenance_suppliers by name (case-insensitive);
//   missing contractors are created (trade 'other') on commit, using
//   `contractor_email` when provided.
// - `document` is an optional file path relative to import/ — uploaded to the
//   private certificate_docs bucket as <tenant>/<property>/<uuid>-<filename>.
// - Idempotent via certificates.import_ref = cert:<property>:<type>:<expiry>
//   (partial unique index per tenant); rows whose import_ref already exists
//   are skipped, and an existing row matching (property, type, expiry) gets
//   its import_ref backfilled instead of a duplicate insert.
// - Dry run writes nothing and refuses --commit while blocking issues exist.

import { readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_TENANT_ID, PROPERTY_DB_ALIASES } from "./config.mjs";
import { adminClient } from "./lib/db.mjs";

const COMMIT = process.argv.includes("--commit");
const csvArg = process.argv.indexOf("--csv");
const CSV_PATH = csvArg > -1 ? process.argv[csvArg + 1] : "import/source/certificates.csv";
const tenantArg = process.argv.indexOf("--tenant");
const TENANT_ID = tenantArg > -1 ? process.argv[tenantArg + 1] : DEFAULT_TENANT_ID;

const BUCKET = "certificate_docs";

const TYPES = {
  gas_safety: "gas_safety", gas: "gas_safety", cp12: "gas_safety", "gas safety": "gas_safety",
  eicr: "eicr", electrical: "eicr",
  epc: "epc",
  fire_alarm: "fire_alarm", "fire alarm": "fire_alarm", fire: "fire_alarm",
  emergency_lighting: "emergency_lighting", "emergency lighting": "emergency_lighting",
  legionella: "legionella",
  pat: "pat",
  hmo_licence: "hmo_licence", "hmo license": "hmo_licence", "hmo licence": "hmo_licence", hmo: "hmo_licence",
};

const MIME = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Minimal quoted-CSV parser (fields may contain commas inside double quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// Accepts YYYY-MM-DD or DD/MM/YYYY.
function toISO(raw) {
  const v = (raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s) => (s ?? "").trim().toLowerCase();

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}\nCopy import/source/certificates.template.csv to ${CSV_PATH} and fill it in.`);
    process.exit(1);
  }

  const sb = adminClient();
  const get = async (q) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  };

  const [props, units, suppliers, existing] = await Promise.all([
    get(sb.from("properties").select("id, name").eq("tenant_id", TENANT_ID)),
    get(sb.from("units").select("id, property_id, room_number").eq("tenant_id", TENANT_ID)),
    get(sb.from("maintenance_suppliers").select("id, name, email").eq("tenant_id", TENANT_ID)),
    get(sb.from("certificates").select("id, property_id, type, expiry_date, import_ref").eq("tenant_id", TENANT_ID)),
  ]);

  const propByName = new Map(props.map((p) => [norm(p.name), p]));
  for (const [alias, dbName] of Object.entries(PROPERTY_DB_ALIASES)) {
    const p = propByName.get(norm(dbName));
    if (p) propByName.set(norm(alias), p);
  }
  const supplierByName = new Map(suppliers.map((s) => [norm(s.name), s]));
  const existingRefs = new Set(existing.filter((e) => e.import_ref).map((e) => e.import_ref));
  const existingNatural = new Map(
    existing.map((e) => [`${e.property_id}:${e.type}:${e.expiry_date}`, e])
  );

  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const header = rows.shift().map((h) => norm(h));
  const col = (name) => header.indexOf(name);
  for (const required of ["property", "type", "issue_date", "expiry_date"]) {
    if (col(required) === -1) {
      console.error(`CSV is missing the required column "${required}" — see certificates.template.csv`);
      process.exit(1);
    }
  }

  const issues = [];
  const plan = [];       // inserts
  const refBackfills = []; // existing rows that just need import_ref stamped
  const newSuppliers = new Map(); // name -> email

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const cell = (name) => (col(name) === -1 ? "" : (row[col(name)] ?? "").trim());

    const propName = cell("property");
    const prop = propByName.get(norm(propName));
    if (!prop) return issues.push(`line ${line}: unknown property "${propName}"`);

    const type = TYPES[norm(cell("type"))];
    if (!type) return issues.push(`line ${line}: unknown certificate type "${cell("type")}"`);

    const issueISO = toISO(cell("issue_date"));
    const expiryISO = toISO(cell("expiry_date"));
    if (!issueISO) return issues.push(`line ${line}: bad issue_date "${cell("issue_date")}" (use YYYY-MM-DD or DD/MM/YYYY)`);
    if (!expiryISO) return issues.push(`line ${line}: bad expiry_date "${cell("expiry_date")}"`);
    if (expiryISO <= issueISO) return issues.push(`line ${line}: expiry_date must be after issue_date`);

    let unitId = null;
    if (cell("unit")) {
      const unit = units.find(
        (u) => u.property_id === prop.id && norm(u.room_number) === norm(cell("unit"))
      );
      if (!unit) return issues.push(`line ${line}: no room "${cell("unit")}" in ${prop.name}`);
      unitId = unit.id;
    }

    let contractorId = null;
    let contractorPending = null;
    if (cell("contractor")) {
      const supplier = supplierByName.get(norm(cell("contractor")));
      if (supplier) contractorId = supplier.id;
      else {
        contractorPending = cell("contractor");
        if (!newSuppliers.has(norm(contractorPending))) {
          newSuppliers.set(norm(contractorPending), {
            name: contractorPending,
            email: cell("contractor_email") || null,
          });
        }
      }
    }

    let documentPath = null;
    if (cell("document")) {
      documentPath = join("import", cell("document"));
      if (!existsSync(documentPath)) {
        return issues.push(`line ${line}: document file not found: ${documentPath}`);
      }
    }

    const importRef = `cert:${slug(prop.name)}:${type}:${expiryISO}`;
    if (existingRefs.has(importRef)) return; // already imported

    const natural = existingNatural.get(`${prop.id}:${type}:${expiryISO}`);
    if (natural) {
      if (!natural.import_ref) refBackfills.push({ id: natural.id, importRef });
      return;
    }

    plan.push({
      line,
      label: `${prop.name}${cell("unit") ? ` room ${cell("unit")}` : ""} — ${type} exp ${expiryISO}`,
      values: {
        tenant_id: TENANT_ID,
        property_id: prop.id,
        unit_id: unitId,
        type,
        issue_date: issueISO,
        expiry_date: expiryISO,
        contractor_id: contractorId,
        reference: cell("reference") || null,
        notes: cell("notes") || null,
        import_ref: importRef,
      },
      contractorPending,
      documentPath,
    });
  });

  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"} — tenant ${TENANT_ID}`);
  console.log(`  ${plan.length} certificates to insert, ${refBackfills.length} import_ref backfills, ${newSuppliers.size} contractors to create`);
  for (const x of plan) {
    console.log(`  ${x.label}${x.contractorPending ? `  (+new contractor: ${x.contractorPending})` : ""}${x.documentPath ? "  [doc]" : ""}`);
  }
  for (const i of issues) console.log(`  ISSUE: ${i}`);

  if (issues.length && COMMIT) {
    console.error(`\nRefusing to commit with ${issues.length} blocking issue(s) — fix the CSV first.`);
    process.exit(1);
  }
  if (!COMMIT) {
    console.log(`\nDry run — nothing written. Re-run with --commit to apply.`);
    return;
  }

  // Create missing contractors first so inserts can link them.
  for (const [key, s] of newSuppliers) {
    const { data, error } = await sb
      .from("maintenance_suppliers")
      .insert({ tenant_id: TENANT_ID, name: s.name, trade: "other", email: s.email })
      .select("id, name")
      .single();
    if (error) throw new Error(`create contractor ${s.name}: ${error.message}`);
    supplierByName.set(key, data);
    console.log(`  created contractor ${data.name}`);
  }
  for (const x of plan) {
    if (x.contractorPending) {
      x.values.contractor_id = supplierByName.get(norm(x.contractorPending))?.id ?? null;
    }
  }

  for (const b of refBackfills) {
    const { error } = await sb
      .from("certificates")
      .update({ import_ref: b.importRef })
      .eq("id", b.id)
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error(`import_ref backfill ${b.importRef}: ${error.message}`);
  }

  let inserted = 0;
  for (const x of plan) {
    if (x.documentPath) {
      const ext = x.documentPath.split(".").pop().toLowerCase();
      const storagePath = `${TENANT_ID}/${x.values.property_id}/${randomUUID()}-${basename(x.documentPath)}`;
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(storagePath, readFileSync(x.documentPath), {
          contentType: MIME[ext] ?? "application/octet-stream",
        });
      if (upErr) throw new Error(`upload ${x.documentPath}: ${upErr.message}`);
      x.values.document_url = storagePath;
    }
    const { error } = await sb.from("certificates").insert(x.values);
    if (error) throw new Error(`insert ${x.label}: ${error.message}`);
    inserted++;
  }

  console.log(`\nDone — ${inserted} certificates inserted, ${refBackfills.length} refs backfilled.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
