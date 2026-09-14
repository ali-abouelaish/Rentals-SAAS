// Single source of truth for BoldSign configuration (e-signing: AST tenancy
// agreements, works orders, owner statement sign-offs). See
// docs/boldsign-integration-plan.md.
//
// Every value is read from the environment at call time — never at module load
// — so a missing key fails at the call site with a useful message rather than
// crashing the server at boot. Mirrors src/lib/dps/config.ts.
//
// Region: we default to the EU host for data residency (agencies are UK
// letting agents). The SDK's own default is the US host, which is precisely
// why boldSignHost() exists and why every API class must be constructed
// through src/lib/boldsign/client.ts rather than directly.

export type BoldSignEnvironment = "sandbox" | "live";

/** EU data region. The SDK defaults to https://api.boldsign.com (US). */
export const BOLDSIGN_EU_HOST = "https://api-eu.boldsign.com";

/**
 * API host. Override with BOLDSIGN_HOST only to target another data region;
 * leaving it unset keeps every call inside the EU.
 */
export function boldSignHost(): string {
  const host = process.env.BOLDSIGN_HOST?.trim();
  if (!host) return BOLDSIGN_EU_HOST;
  // A trailing slash produces "…//v1/document/list" once the SDK concatenates.
  return host.replace(/\/+$/, "");
}

/**
 * sandbox | live. Drives the `isSandbox` flag on send requests, so a
 * misconfigured deployment can't quietly send real tenancy agreements.
 * Defaults to sandbox — going live must be a deliberate act.
 */
export function boldSignEnv(): BoldSignEnvironment {
  return process.env.BOLDSIGN_ENV?.trim() === "live" ? "live" : "sandbox";
}

export function isBoldSignSandbox(): boolean {
  return boldSignEnv() === "sandbox";
}

export function boldSignApiKey(): string {
  const key = process.env.BOLDSIGN_API_KEY?.trim();
  if (!key) throw new Error("BOLDSIGN_API_KEY env var is not set.");
  return key;
}

export function boldSignWebhookSecret(): string {
  const secret = process.env.BOLDSIGN_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("BOLDSIGN_WEBHOOK_SECRET env var is not set.");
  return secret;
}

/** True when the API key is present — for feature gating without throwing. */
export function isBoldSignConfigured(): boolean {
  return Boolean(process.env.BOLDSIGN_API_KEY?.trim());
}
