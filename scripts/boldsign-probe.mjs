// BoldSign sandbox probe — Phase 1 acceptance check
// (see docs/boldsign-integration-plan.md §1).
//
// Proves the API key and the EU host authenticate before any integration code
// depends on them. Read-only: it lists one document and writes nothing.
//
//   npm run boldsign:probe
//
// Requires in .env.local:
//   BOLDSIGN_API_KEY=...        (sandbox key from the BoldSign app → API keys)
//   BOLDSIGN_HOST=...           (optional; defaults to the EU host)
//   BOLDSIGN_WEBHOOK_SECRET=... (optional here; checked for presence only,
//                                exercised in Phase 3)
//
// An account with zero documents is a PASS — what's being tested is that the
// request is accepted, not that documents exist.
//
// Note: this sets process.exitCode and returns rather than calling
// process.exit(). Calling process.exit() while fetch's sockets are still
// closing trips a libuv assertion on Windows and reports exit 127 instead of 1.

const EU_HOST = "https://api-eu.boldsign.com";

async function main() {
  const apiKey = process.env.BOLDSIGN_API_KEY?.trim();
  const host = (process.env.BOLDSIGN_HOST?.trim() || EU_HOST).replace(/\/+$/, "");
  const env = process.env.BOLDSIGN_ENV?.trim() === "live" ? "live" : "sandbox";

  if (!apiKey) {
    console.error("Set BOLDSIGN_API_KEY in .env.local first.");
    return 1;
  }

  console.log(`host: ${host}`);
  console.log(`env:  ${env}`);
  if (host !== EU_HOST) {
    console.warn(`WARNING: not the EU host (${EU_HOST}) — check data residency.`);
  }
  if (env === "live") {
    console.warn("WARNING: BOLDSIGN_ENV=live — this is not the sandbox.");
  }
  console.log("");

  // Called through raw fetch rather than the SDK so the probe tests the key and
  // host themselves, independently of our wrapper. src/lib/boldsign/client.ts
  // exercises the same endpoint through the SDK.
  const url = `${host}/v1/document/list?Page=1&PageSize=1`;

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { "X-API-KEY": apiKey, Accept: "application/json" },
    });
  } catch (err) {
    console.error(`FAIL — could not reach ${host}: ${err.message}`);
    return 1;
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    console.error(`FAIL — HTTP ${res.status} ${res.statusText}`);
    if (body) {
      console.error(typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body, null, 2));
    }
    if (res.status === 401 || res.status === 403) {
      console.error("Auth rejected. Check the key is for this region's account and not revoked.");
    }
    return 1;
  }

  const total = body?.pageDetails?.totalRecordsCount ?? null;
  console.log(`PASS — HTTP ${res.status}, authenticated against ${host}`);
  console.log(`documents visible to this key: ${total ?? "unknown"}`);

  if (!process.env.BOLDSIGN_WEBHOOK_SECRET?.trim()) {
    console.log("\nNote: BOLDSIGN_WEBHOOK_SECRET is not set. Not needed yet — Phase 3 requires it.");
  }

  return 0;
}

process.exitCode = await main();
