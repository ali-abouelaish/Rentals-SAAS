// Single source of truth for DPS (Deposit Protection Service / Computershare)
// API endpoints. Auth is OAuth 2.0 client-credentials with per-agency keys —
// there is no software-provider tier, so each agency supplies its own client
// ID + secret (entered by a super admin, stored encrypted in dps_connections).
// See "api docs/DPS/" and docs/dps-integration-plan.md.
//
// Verified against UAT 2026-07-07 (scripts/dps-uat-probe.mjs): the token
// endpoint lives on the same host as the tenancy endpoints and success
// responses use HTTP 201.

export type DpsEnvironment = "uat" | "production";

const ENV_URLS: Record<DpsEnvironment, { apiBase: string }> = {
  uat: { apiBase: "https://api-uat.depositprotection.com" },
  production: { apiBase: "https://api.depositprotection.com" },
};

export const DPS_TOKEN_PATH = "/v1.0/connect/token";
export const DPS_CREATE_TENANCY_PATH = "/v1.0/tenancy/create";
export const DPS_MARK_FOR_BANK_TRANSFER_PATH = "/v1.0/tenancy/MarkForBankTransfer";

// Tokens last 1200s; refresh one minute early so an in-flight call never
// crosses the expiry boundary.
export const DPS_TOKEN_TTL_SAFETY_MS = 60_000;

export function dpsApiBase(env: DpsEnvironment): string {
  return ENV_URLS[env].apiBase;
}
