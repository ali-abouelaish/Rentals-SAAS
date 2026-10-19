// p10 — PM settings (WRITES: an API key, then revoked + deleted).
//
// Settings pages render + validate; the API-key lifecycle is the security check
// (401 no/garbage key, 403 insufficient scope, 401 after revoke). Email /
// integrations / e-signing / deposits / billing-info are render-only — nothing is
// activated or connected.
//
//   node e2e/pm/p10-settings.mjs

import {
  openSignedIn,
  url,
  check,
  skip,
  summary,
  db,
  track,
  attachErrorCapture,
  visit,
  writeResults,
} from "./lib/pm.mjs";

const SETTINGS_ROUTES = [
  "/settings/team",
  "/settings/bank-details",
  "/settings/api-keys",
  "/settings/email",
  "/settings/messaging",
  "/settings/integrations",
  "/settings/deposits",
  "/settings/e-signing",
  "/settings/billing-info",
];

async function publicGet(key) {
  const res = await fetch(url("/api/public/scraped-listings"), {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  }).catch(() => null);
  return res?.status ?? 0;
}

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p10");
const { client, tenantId } = await db();

console.log("\np10 — PM settings (writes: API key)\n");

try {
  // 10.1 — every settings page renders.
  let n = 0;
  for (const route of SETTINGS_ROUTES) {
    await check(`10.1.${++n}`, `settings page renders: ${route}`, async () => {
      cap.tag(`10.1.${n}`, route);
      return await visit(page, route, cap, { settle: 400 });
    });
  }

  // 10.2 — public API rejects an unauthenticated / garbage caller.
  await check("10.2a", "public API: no key → 401", async () => {
    const s = await publicGet(null);
    return { pass: s === 401, detail: `HTTP ${s} (expected 401)` };
  });
  await check("10.2b", "public API: garbage key → 401", async () => {
    const s = await publicGet("pk_live_totally-made-up-key-0000");
    return { pass: s === 401, detail: `HTTP ${s} (expected 401)` };
  });

  // 10.3 — mint a key, use it (no scope → 403), revoke (→ 401), delete.
  let plaintext = null;
  await check("10.3a", "mint an API key (plaintext revealed once)", async () => {
    cap.tag("10.3a", "/settings/api-keys");
    const nav = await visit(page, "/settings/api-keys", cap, { settle: 500 });
    if (!nav.pass) return nav;
    await page.locator('input[name="label"]').fill("PM5-API Key");
    await page.getByRole("button", { name: /create key/i }).click();
    await page.waitForTimeout(1500);
    // The full key is revealed once in the amber box's <code>.
    const codes = await page.locator("code").allInnerTexts().catch(() => []);
    plaintext = codes.map((c) => c.trim()).find((c) => c.length > 20 && !c.endsWith("…"));
    const row = (await client.from("public_api_keys").select("id,scopes").eq("tenant_id", tenantId).eq("label", "PM5-API Key").order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
    if (row) track("public_api_keys", row.id);
    return { pass: Boolean(plaintext) && Boolean(row), detail: plaintext ? `key revealed (scopes=[${row?.scopes?.join(",") ?? ""}])` : "no plaintext revealed" };
  });

  await check("10.3b", "valid key with the scope → 200 (accepted)", async () => {
    if (!plaintext) return { pass: null, detail: "no key minted" };
    const s = await publicGet(plaintext);
    // Keys default to scopes=[scraped_listings:read], so the public API accepts.
    // (A scopeless key would get 403, but there is no UI to mint one.)
    return { pass: s === 200, detail: `HTTP ${s} (expected 200 accepted; 403-insufficient-scope path not UI-testable)` };
  });

  await check("10.3c", "revoke the key → 401", async () => {
    if (!plaintext) return { pass: null, detail: "no key minted" };
    cap.tag("10.3c", "/settings/api-keys");
    await visit(page, "/settings/api-keys", cap, { settle: 500 });
    await page.getByRole("button", { name: /^revoke/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const s = await publicGet(plaintext);
    return { pass: s === 401, detail: `HTTP ${s} after revoke (expected 401)` };
  });

  await check("10.3d", "delete the key (row removed)", async () => {
    const before = (await client.from("public_api_keys").select("id").eq("tenant_id", tenantId).eq("label", "PM5-API Key").maybeSingle()).data;
    if (!before) return { pass: null, detail: "no key row to delete" };
    cap.tag("10.3d", "/settings/api-keys");
    await visit(page, "/settings/api-keys", cap, { settle: 500 });
    await page.getByRole("button", { name: /^delete/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const after = (await client.from("public_api_keys").select("id").eq("id", before.id).maybeSingle()).data;
    return { pass: !after, detail: after ? "still present" : "deleted" };
  });

  // 10.4 — paid/connect pages are render-only (confirmed by 10.1 rendering them;
  // this run never clicks activate/connect).
  skip("10.4", "email / integrations / e-signing / deposits / billing-info activation", "render-only per run rules — never activated or connected");
} finally {
  const result = summary("p10");
  writeResults("p10", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}
