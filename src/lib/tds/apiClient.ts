// Minimal TDS API client. For now this only covers credential verification —
// the full deposit lifecycle (CreateDeposit, status polling, DPC, repayment) is
// a follow-up. Auth is path-based: member_id / branch_id / api_key are segments
// in the URL (see "api docs/TDS API.md").

import { tdsApiBase, type TdsEnvironment } from "./config";
import { extractError, isSuccessBody } from "./parse";

export type TdsCredentials = {
  environment: TdsEnvironment;
  memberId: string;
  branchId: string;
  apiKey: string;
};

export type TdsVerifyResult = { ok: boolean; error?: string };

/**
 * Verify a set of TDS credentials authenticate, using the read-only landlord
 * search (the lightest call that exercises member_id + branch_id + api_key).
 * Returns { ok: true } when TDS accepts the credentials, otherwise a message.
 */
export async function verifyTdsCredentials(creds: TdsCredentials): Promise<TdsVerifyResult> {
  const { environment, memberId, branchId, apiKey } = creds;
  const base = tdsApiBase(environment);
  const url = `${base}/landlord/${encodeURIComponent(memberId)}/${encodeURIComponent(
    branchId
  )}/${encodeURIComponent(apiKey)}/?limit=1`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not reach TDS (${environment}): ${message}` };
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (res.status === 403) {
    return {
      ok: false,
      error:
        extractError(body) ??
        "TDS rejected the credentials (403). Check member_id, branch_id and api_key.",
    };
  }

  if (res.ok) {
    // A well-formed search returns isSuccess: true even with zero results.
    if (isSuccessBody(body) || body === null) return { ok: true };
    const err = extractError(body);
    return err ? { ok: false, error: err } : { ok: true };
  }

  return {
    ok: false,
    error: extractError(body) ?? `TDS request failed (HTTP ${res.status}).`,
  };
}
