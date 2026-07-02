// Minimal TDS API client. For now this only covers credential verification —
// the full deposit lifecycle (CreateDeposit, status polling, DPC, repayment) is
// a follow-up. Auth is path-based: member_id / branch_id / api_key are segments
// in the URL (see "api docs/TDS API.md").

import { tdsApiBase, type TdsEnvironment } from "./config";

export type TdsCredentials = {
  environment: TdsEnvironment;
  memberId: string;
  branchId: string;
  apiKey: string;
};

export type TdsVerifyResult = { ok: boolean; error?: string };

// TDS responses are inconsistent: success bodies use `isSuccess: true`, error
// bodies use `success: "false"` plus an `errors` map/array. Pull a human message
// out of whatever shape comes back.
function extractError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const errors = (body as Record<string, unknown>).errors;
  const collect = (obj: Record<string, unknown>): string | null => {
    const parts = Object.entries(obj)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => `${k}: ${v as string}`);
    return parts.length ? parts.join("; ") : null;
  };
  if (Array.isArray(errors)) {
    const msgs = errors
      .map((e) => (e && typeof e === "object" ? collect(e as Record<string, unknown>) : null))
      .filter(Boolean);
    return msgs.length ? msgs.join("; ") : null;
  }
  if (errors && typeof errors === "object") {
    return collect(errors as Record<string, unknown>);
  }
  return null;
}

function isSuccessBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.isSuccess === true || b.success === true || b.success === "true";
}

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
