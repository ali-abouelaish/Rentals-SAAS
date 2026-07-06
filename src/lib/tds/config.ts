// Single source of truth for TDS Custodial Deposit Management API endpoints.
// Auth is path-based (member_id / branch_id / api_key embedded in the URL),
// not OAuth — there is no software-provider tier, so each agency supplies its
// own credentials. See "api docs/TDS API.md" §2.3 for the base URLs.

export type TdsEnvironment = "sandbox" | "production";
export type TdsRegion = "EW" | "NI";
export type TdsSchemeType = "Custodial" | "Insured";

const ENV_URLS: Record<TdsEnvironment, { apiBase: string }> = {
  sandbox: { apiBase: "https://sandbox.api.custodial.tenancydepositscheme.com" },
  production: { apiBase: "https://api.custodial.tenancydepositscheme.com" },
};

// Every TDS endpoint is served under the version segment (e.g. /v1.2/landlord,
// /v1.2/CreateDeposit, /v1.2/CreateDepositStatus, /v1.2/dpc,
// /v1.2/RaiseRepaymentRequest). Verified against the sandbox: the un-versioned
// paths 404; only the /v1.2/-prefixed paths resolve. The docs' claim that read
// endpoints omit the version was wrong.
export const TDS_API_VERSION = "v1.2";

export function tdsApiBase(env: TdsEnvironment): string {
  return ENV_URLS[env].apiBase;
}
