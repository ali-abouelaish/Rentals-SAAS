// Round 3 Phase 12 — cross-cutting sweeps (plan steps 66-67).
//
// Read-only and fully scripted, so this is the phase worth running on every
// build. It walks the real route tree rather than a hand-kept list: routes get
// added faster than a checklist gets updated, and an unguarded new endpoint is
// exactly what this is meant to catch.
//
// Two invariants:
//   66. No /api/* route returns data to an unauthenticated caller.
//   67. No /api/cron/* route runs without the bearer secret (fail-closed).
//
//   node e2e/phase12-sweeps.mjs

import fs from "node:fs";
import path from "node:path";
import { BASE_URL, openAnonymous, check, summary } from "./lib/harness.mjs";

const APP_API = path.resolve("src/app/api");

/** Every GET-able API route, derived from the filesystem. */
function discoverRoutes(dir = APP_API, prefix = "/api") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Dynamic segments get a syntactically valid but non-existent id, so a
      // 404 means "no such row" and never "malformed url".
      const seg = /^\[.+\]$/.test(entry.name)
        ? "00000000-0000-4000-8000-000000000000"
        : entry.name;
      out.push(...discoverRoutes(full, `${prefix}/${seg}`));
    } else if (entry.name === "route.ts") {
      const src = fs.readFileSync(full, "utf8");
      out.push({
        path: prefix,
        methods: {
          GET: /export async function GET|export const GET/.test(src),
          POST: /export async function POST|export const POST/.test(src),
        },
        file: path.relative(process.cwd(), full).replace(/\\/g, "/"),
      });
    }
  }
  return out;
}

// Routes that are public BY DESIGN. Each needs a reason, because adding to this
// list is how a real hole would get waved through.
const INTENTIONALLY_PUBLIC = [
  [/^\/api\/webhooks\//, "inbound webhook; authenticated by HMAC signature, not session"],
  [/^\/api\/leads\/webhook/, "inbound lead webhook; shared-secret guarded"],
  [/^\/api\/invite\/complete/, "invite acceptance happens before a session exists"],
  [/^\/api\/support/, "public renter support widget; tenant resolved from the host"],
  [/^\/api\/portal/, "renter portal; magic-link token auth, rate limited"],
  [/^\/api\/shares\//, "public share links; token in the url"],
  [/^\/api\/public\//, "public API; api-key + scope auth"],
  [/^\/api\/email\/(gmail|graph)\/callback/, "OAuth callback; single-use state"],
  [/^\/api\/gmail\/callback/, "OAuth callback; single-use state"],
  [/^\/api\/landlords\/spareroom-profiles/, "scraper; SCRAPER_API_KEY bearer"],
  [/^\/api\/market\/spareroom-search-targets/, "scraper; SCRAPER_API_KEY bearer"],
];

// Routes whose guard is on NODE_ENV, so a dev server cannot demonstrate it.
// Asserting the guard exists in source beats asserting a 404 we would only see
// in production — and beats silently exempting the route.
const DEV_ONLY = [
  ["/api/dev-works-order-preview", "src/app/api/dev-works-order-preview/route.ts"],
];

function publicReason(p) {
  const hit = INTENTIONALLY_PUBLIC.find(([re]) => re.test(p));
  return hit ? hit[1] : null;
}

/** Did this response hand back real data? */
function looksLikeData(status, body) {
  if (status !== 200) return false;
  const t = body.trim();
  if (!t) return false;
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object") {
      const keys = Object.keys(parsed);
      if (keys.every((k) => ["error", "message", "ok"].includes(k))) return false;
      return keys.length > 0;
    }
  } catch {
    return t.length > 200; // non-JSON 200 with a real body
  }
  return false;
}

const routes = discoverRoutes();
const cronRoutes = routes.filter((r) => r.path.startsWith("/api/cron/"));
const otherRoutes = routes.filter((r) => !r.path.startsWith("/api/cron/"));

console.log(`\nRound 3 Phase 12 — cross-cutting sweeps`);
console.log(`Discovered ${routes.length} API routes (${cronRoutes.length} cron).\n`);

const { browser, context } = await openAnonymous();

async function anonGet(p) {
  const res = await context.request.get(new URL(p, BASE_URL).toString(), {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  return { status: res.status(), body: await res.text().catch(() => "") };
}

// --- 67: cron fail-closed ---------------------------------------------------
console.log("Step 67 — /api/cron/* must reject an unauthenticated caller\n");
for (const r of cronRoutes) {
  await check(`67:${r.path}`, "rejects without bearer token", async () => {
    const { status, body } = await anonGet(r.path);
    const denied = status === 401 || status === 403;
    return {
      pass: denied,
      detail: denied ? `HTTP ${status}` : `HTTP ${status} — expected 401/403. ${body.slice(0, 120)}`,
    };
  });
}

// --- 66: no unauthenticated data -------------------------------------------
console.log("\nStep 66 — no /api/* route returns data without a session\n");
for (const r of otherRoutes) {
  if (!r.methods.GET) continue;

  const devOnly = DEV_ONLY.find(([p]) => p === r.path);
  if (devOnly) {
    await check(`66:${r.path}`, "dev-only route is guarded for production", async () => {
      const src = fs.readFileSync(devOnly[1], "utf8");
      const guarded =
        /process\.env\.NODE_ENV\s*===\s*["']production["']/.test(src) &&
        /404|notFound|status:\s*404/.test(src);
      return {
        pass: guarded,
        detail: guarded
          ? "source 404s when NODE_ENV=production (cannot be exercised on a dev server)"
          : "NO PRODUCTION GUARD — this route would be public in prod",
      };
    });
    continue;
  }

  const reason = publicReason(r.path);
  await check(`66:${r.path}`, reason ? `public by design (${reason})` : "denies anonymous", async () => {
    const { status, body } = await anonGet(r.path);
    const leaked = looksLikeData(status, body);
    if (reason) {
      // Still assert it did not hand back a populated payload unprompted.
      return {
        pass: !leaked,
        detail: leaked ? `RETURNED DATA anonymously (HTTP ${status})` : `HTTP ${status}, no payload`,
      };
    }
    return {
      pass: !leaked,
      detail: leaked
        ? `LEAK: returned data with no session (HTTP ${status}) — ${r.file}`
        : `HTTP ${status}`,
    };
  });
}

const result = summary("Phase 12 (steps 66-67)");
await browser.close();
process.exit(result.fail > 0 ? 1 : 0);
