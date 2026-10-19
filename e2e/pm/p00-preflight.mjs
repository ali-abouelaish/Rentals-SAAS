// p00 — Preflight (READ-ONLY).
//
// Proves the run is pointed at the right place and the ground truth the later
// phases assume actually holds, before a single write. Nothing here mutates data.
//
// Checks:
//   00.1 Usage gate — record the current reading (Claude acts on `wait`, not this).
//   00.2 Write guard — the signed-in account resolves to tenant slug `test`.
//   00.3 PM module live — agency_module_configs.live_property_management_enabled.
//   00.4 Entitlement snapshot — written to artifacts so phases skip OFF features.
//   00.5 Stylesheet live — Tailwind utilities are generating (stale-CSS trap).
//   00.6 Schema sanity — property_contracts.document_path exists; the
//        property_contracts bucket is PRIVATE; properties.contract_document_path
//        exists. Every migration is applied, so a miss here is a real bug.
//   00.7 Isolation smoke — a foreign-tenant id denies BEFORE any write phase runs
//        (the full isolation sweep is p12, but it runs last, after the writes).
//
//   node e2e/pm/p00-preflight.mjs

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  openSignedIn,
  url,
  check,
  summary,
  assertStylesheetIsLive,
  db,
  attachErrorCapture,
  visit,
  writeResults,
  PM_ARTIFACTS,
} from "./lib/pm.mjs";
import fs from "node:fs";

// Foreign-tenant ids from the round-2 isolation fixtures.
const FOREIGN = {
  property: "bb100000-0000-4000-8000-000000000003",
  contract: "e1ff404d-49f5-4bbb-bac0-19a029f3b7bf",
};
const POPULATED = [/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/, /rent\s*£\s*[\d,]+/i, /tenancy start/i];

console.log("\np00 — Preflight (read-only)\n");

// 00.1 — usage gate reading (informational; the protocol is driven by Claude).
await check("00.1", "usage gate readable", async () => {
  const g = spawnSync("node", ["e2e/usage-gate.mjs"], { encoding: "utf8" });
  let verdict = "unknown";
  try {
    verdict = JSON.parse(g.stdout || "{}").verdict ?? "unknown";
  } catch {
    /* leave unknown */
  }
  return { pass: verdict !== "wait", detail: `verdict=${verdict}` };
});

// 00.2 + 00.3 + 00.4 + 00.6 all need the service-role client.
let scoped;
await check("00.2", "write guard resolves to tenant slug `test`", async () => {
  scoped = await db(); // throws unless slug === test
  return { pass: scoped.tenant.slug === "test", detail: `${scoped.tenant.name} (${scoped.tenant.slug})` };
});

await check("00.3", "PM module is live for this tenant", async () => {
  if (!scoped) return { pass: false, detail: "no db handle" };
  const { data, error } = await scoped.client
    .from("agency_module_configs")
    .select("live_property_management_enabled, live_rental_agency_enabled")
    .eq("tenant_id", scoped.tenantId)
    .maybeSingle();
  if (error) return { pass: false, detail: error.message };
  return {
    pass: Boolean(data?.live_property_management_enabled),
    detail: `pm=${data?.live_property_management_enabled} ra=${data?.live_rental_agency_enabled}`,
  };
});

await check("00.4", "entitlement snapshot captured", async () => {
  if (!scoped) return { pass: false, detail: "no db handle" };
  const { data, error } = await scoped.client
    .from("tenant_feature_entitlements")
    .select("feature_key, is_enabled, ends_on")
    .eq("tenant_id", scoped.tenantId);
  if (error) return { pass: false, detail: error.message };
  const rows = data ?? [];
  fs.writeFileSync(
    path.join(PM_ARTIFACTS, "entitlements.json"),
    JSON.stringify({ tenantId: scoped.tenantId, rows, capturedAt: new Date().toISOString() }, null, 2)
  );
  const off = rows.filter((r) => !r.is_enabled).map((r) => r.feature_key);
  return { pass: true, detail: `${rows.length} rows; explicitly OFF: ${off.join(", ") || "none"}` };
});

// 00.6 — schema sanity. Every migration is applied, so these must hold.
await check("00.6a", "property_contracts.document_path column exists", async () => {
  if (!scoped) return { pass: false, detail: "no db handle" };
  const { error } = await scoped.client.from("property_contracts").select("document_path").limit(1);
  // 42703 = undefined_column
  const missing = error && (error.code === "42703" || /document_path/.test(error.message));
  return { pass: !missing, detail: missing ? `MISSING: ${error.message}` : "present" };
});

await check("00.6b", "properties.contract_document_path column exists", async () => {
  if (!scoped) return { pass: false, detail: "no db handle" };
  const { error } = await scoped.client.from("properties").select("contract_document_path").limit(1);
  const missing = error && (error.code === "42703" || /contract_document_path/.test(error.message));
  return { pass: !missing, detail: missing ? `MISSING: ${error.message}` : "present" };
});

await check("00.6c", "property_contracts storage bucket is PRIVATE", async () => {
  if (!scoped) return { pass: false, detail: "no db handle" };
  const { data, error } = await scoped.client.storage.getBucket("property_contracts");
  if (error) return { pass: false, detail: `getBucket failed: ${error.message}` };
  return { pass: data?.public === false, detail: `public=${data?.public}` };
});

// Browser-dependent checks (need the dev server up).
const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p00");
try {
  await check("00.5", "Tailwind stylesheet is live (not stale)", async () => {
    cap.tag("00.5", "/dashboard");
    const nav = await visit(page, "/dashboard", cap);
    if (!nav.pass) return { pass: false, detail: `dashboard did not load: ${nav.detail}` };
    const live = await assertStylesheetIsLive(page);
    return { pass: live.ok, detail: live.detail };
  });

  await check("00.7", "foreign property id denies (pre-write isolation smoke)", async () => {
    cap.tag("00.7", `/properties/${FOREIGN.property}`);
    const res = await page.goto(url(`/properties/${FOREIGN.property}`), { waitUntil: "networkidle" }).catch(() => null);
    const status = res?.status() ?? 0;
    const body = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    const landed = new URL(page.url()).pathname;
    const notFound = status === 404 || /not found|doesn.t exist|404/i.test(body);
    const redirected = landed !== `/properties/${FOREIGN.property}`;
    const leaked = POPULATED.some((re) => re.test(body)) && !notFound;
    return {
      pass: !leaked,
      detail: leaked
        ? `LEAK: foreign property rendered (HTTP ${status})`
        : `denied (HTTP ${status}${redirected ? `, → ${landed}` : notFound ? ", not-found" : ""})`,
    };
  });
} finally {
  const result = summary("p00");
  writeResults("p00", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}
