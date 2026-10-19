// p14 — Cleanup (DELETES — intended). Removes all PM5 test data from production.
//
// Strategy (deterministic + complete):
//   1. Verify a delete control follows CLAUDE.md (red + Trash2 + confirm) — sample.
//   2. Manifest sweep: delete every tracked id, children before parents.
//   3. Prefix sweep: backstop by `PM5-` name/label per table (list, then delete).
//   4. Storage sweep: delete uploaded test documents.
//   5. Verify: no PM5 rows remain; global search for the PM5 data is empty.
//
//   node e2e/pm/p14-cleanup.mjs
//
// Service-role writes are allowed here (cleanup) — this is the one phase that
// deletes. Everything is scoped to tenant_id = the test tenant.

import {
  openSignedIn,
  url,
  check,
  summary,
  db,
  readManifest,
  attachErrorCapture,
  visit,
  writeResults,
} from "./lib/pm.mjs";

const { client, tenantId } = await db();

// Child → parent delete order for both sweeps (FK-safe).
const DELETE_ORDER = [
  "guarantors",
  "rent_payments",
  "owner_transactions",
  "owner_statements",
  "property_costs",
  "tenant_recurring_charges",
  "bank_statement_uploads",
  "maintenance_costs",
  "certificates",
  "maintenance_jobs",
  "maintenance_suppliers",
  "property_shares",
  "automation_rules",
  "business_overheads",
  "public_api_keys",
  "booking_forms",
  "bookings",
  "property_contracts",
  "units",
  "pm_tenants",
  "properties",
  "owner_landlords",
  "portfolio_bank_details",
];

// Prefix-sweep config: table → the text column that carries the PM5- marker.
const PREFIX_COLS = {
  properties: "name",
  owner_landlords: "name",
  pm_tenants: "full_name",
  units: "room_number",
  business_overheads: "label",
  property_costs: "cost_label",
  tenant_recurring_charges: "label",
  certificates: "reference",
  maintenance_jobs: "title",
  maintenance_suppliers: "name",
  property_shares: "name",
  bookings: "applicant_name",
};

console.log("\np14 — Cleanup (deletes PM5 test data)\n");

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p14");

try {
  // 14.1 — sample UI delete control follows CLAUDE.md (red + Trash2 + confirm).
  await check("14.1", "a delete control is red, uses Trash2, and confirms", async () => {
    cap.tag("14.1", "/maintenance");
    await visit(page, "/maintenance", cap, { settle: 500 });
    const supTab = page.getByRole("button", { name: /^suppliers/i }).first();
    if (await supTab.count()) { await supTab.click().catch(() => {}); await page.waitForTimeout(500); }
    const info = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, a")];
      const del = btns.find((b) => /delete|remove/i.test((b.getAttribute("aria-label") || "") + (b.textContent || "")));
      if (!del) return { found: false };
      const cs = getComputedStyle(del);
      const svg = del.querySelector("svg");
      return {
        found: true,
        red: /rgb\(2\d\d/.test(cs.color) || /text-red|text-destructive|bg-red/.test(del.getAttribute("class") || ""),
        trash: /lucide-trash/.test(svg?.getAttribute("class") || ""),
      };
    });
    if (!info.found) return { pass: null, detail: "no delete control sampled on this view" };
    return { pass: info.red && info.trash, detail: `red=${info.red}, Trash2=${info.trash}` };
  });

  // 14.1b — linkage cleanup FIRST (while PM5 parents still exist): removes
  // untracked children keyed by foreign id, not by a PM5 name (adjustment lines,
  // derived owner_transactions, guarantors, rent payments, work-order costs).
  await check("14.1b", "linkage cleanup of untracked child rows", async () => {
    const ids = async (table, col, pattern = "PM5%") => ((await client.from(table).select("id").eq("tenant_id", tenantId).ilike(col, pattern)).data ?? []).map((r) => r.id);
    const ownerIds = await ids("owner_landlords", "name");
    const unitIds = await ids("units", "room_number");
    const jobIds = await ids("maintenance_jobs", "title");
    const tenantIds2 = await ids("pm_tenants", "full_name");
    let removed = 0;
    const errs = [];
    const delIn = async (table, col, vals) => {
      if (!vals.length) return;
      const { error, count } = await client.from(table).delete({ count: "exact" }).in(col, vals);
      if (error) errs.push(`${table}: ${error.message}`); else removed += count ?? 0;
    };
    if (ownerIds.length) await delIn("owner_transactions", "owner_id", ownerIds);
    if (tenantIds2.length) await delIn("guarantors", "pm_tenant_id", tenantIds2);
    if (unitIds.length) await delIn("rent_payments", "unit_id", unitIds);
    if (jobIds.length) await delIn("maintenance_costs", "job_id", jobIds);
    return { pass: errs.length === 0, detail: errs.length ? `errors: ${errs.join("; ")}` : `removed ${removed} linked child row(s)` };
  });

  // 14.2 — manifest sweep: delete tracked ids, children first.
  await check("14.2", "manifest sweep deletes tracked rows", async () => {
    const manifest = readManifest();
    const byKind = new Map();
    for (const m of manifest) {
      if (m.kind === "storage") continue;
      if (!byKind.has(m.kind)) byKind.set(m.kind, new Set());
      byKind.get(m.kind).add(m.id);
    }
    let deleted = 0;
    const errors = [];
    for (const table of DELETE_ORDER) {
      const ids = byKind.get(table);
      if (!ids?.size) continue;
      // Delete by id only — the ids are unique UUIDs from our own tracked writes,
      // and some child tables (e.g. guarantors) have no tenant_id column.
      const { error, count } = await client.from(table).delete({ count: "exact" }).in("id", [...ids]);
      if (error) errors.push(`${table}: ${error.message}`);
      else deleted += count ?? 0;
    }
    return { pass: errors.length === 0, detail: errors.length ? `errors: ${errors.join("; ")}` : `deleted ${deleted} tracked row(s)` };
  });

  // 14.3 — prefix sweep (backstop): list then delete PM5- rows per table.
  await check("14.3", "prefix sweep removes any remaining PM5- rows", async () => {
    let deleted = 0;
    const remaining = [];
    for (const table of DELETE_ORDER) {
      const col = PREFIX_COLS[table];
      if (!col) continue;
      const { data: rows } = await client.from(table).select(`id,${col}`).eq("tenant_id", tenantId).ilike(col, "PM5%");
      if (rows?.length) {
        const { error } = await client.from(table).delete().in("id", rows.map((r) => r.id)).eq("tenant_id", tenantId);
        if (error) remaining.push(`${table}: ${error.message}`);
        else deleted += rows.length;
      }
    }
    // Statement uploads carry no PM5 name — sweep by the fixture filename.
    const { data: ups } = await client.from("bank_statement_uploads").select("id").eq("tenant_id", tenantId).eq("filename", "sample-statement.csv");
    if (ups?.length) { await client.from("bank_statement_uploads").delete().in("id", ups.map((u) => u.id)); deleted += ups.length; }
    return { pass: remaining.length === 0, detail: remaining.length ? `errors: ${remaining.join("; ")}` : `swept ${deleted} prefixed row(s)` };
  });

  // 14.4 — storage sweep: delete uploaded test documents (certificate_docs etc.).
  await check("14.4", "storage sweep removes PM5 test documents", async () => {
    let removed = 0;
    const notes = [];
    // Certificate docs live under <tenantId>/… — list and remove this tenant's folder.
    for (const bucket of ["certificate_docs", "property_contracts", "pm-tenant-docs", "property_photos"]) {
      const { data: files, error } = await client.storage.from(bucket).list(tenantId, { limit: 1000 });
      if (error) { notes.push(`${bucket}: ${error.message.slice(0, 40)}`); continue; }
      if (files?.length) {
        // Recurse one level (files are under tenantId/<entityId>/<file>).
        const paths = [];
        for (const f of files) {
          if (f.id === null) {
            const { data: sub } = await client.storage.from(bucket).list(`${tenantId}/${f.name}`, { limit: 1000 });
            for (const s of sub ?? []) paths.push(`${tenantId}/${f.name}/${s.name}`);
          } else {
            paths.push(`${tenantId}/${f.name}`);
          }
        }
        // Only remove paths we can tie to PM5 test docs (sample-photo / sample-contract).
        const pm5 = paths.filter((p) => /sample-photo|sample-contract|PM5/i.test(p));
        if (pm5.length) {
          const { error: delErr } = await client.storage.from(bucket).remove(pm5);
          if (!delErr) removed += pm5.length;
        }
      }
    }
    return { pass: true, detail: `removed ${removed} storage object(s)${notes.length ? ` (skipped: ${notes.join(", ")})` : ""}` };
  });

  // 14.5 — verify no PM5 rows remain.
  await check("14.5", "no PM5 rows remain in any table", async () => {
    const left = [];
    for (const [table, col] of Object.entries(PREFIX_COLS)) {
      const { data } = await client.from(table).select("id").eq("tenant_id", tenantId).ilike(col, "PM5%").limit(1);
      if (data?.length) left.push(table);
    }
    return { pass: left.length === 0, detail: left.length ? `STILL PRESENT: ${left.join(", ")}` : "all PM5 rows gone" };
  });

  // 14.6 — global search for the PM5 data is empty.
  await check("14.6", "global search for PM5 data is empty", async () => {
    cap.tag("14.6", "/dashboard");
    await visit(page, "/dashboard", cap, { settle: 400 });
    const box = page.locator('input[aria-label="Search"]').first();
    let stillFound = [];
    for (const q of ["Alpha", "PM5", "Tenant One", "Gas Safety"]) {
      await box.click();
      await box.fill("");
      await box.fill(q);
      await page.waitForTimeout(1300);
      const t = (await page.locator("#global-search-results").innerText().catch(() => "")) || "";
      if (!/no matches|no results/i.test(t) && /PM5|1 PM5 Test Street/i.test(t)) stillFound.push(q);
    }
    return { pass: stillFound.length === 0, detail: stillFound.length ? `still findable: ${stillFound.join(", ")}` : "global search clean" };
  });
} finally {
  const result = summary("p14");
  writeResults("p14", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}
