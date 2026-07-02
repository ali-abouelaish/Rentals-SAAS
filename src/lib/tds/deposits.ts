// TDS Custodial deposit-lifecycle endpoints. Auth is path-based (member_id /
// branch_id / api_key are URL segments on the GET endpoints, or body fields on
// the POST endpoints), so unlike mydeposits there is no Bearer header. Every
// call is logged to tds_api_log with the api_key redacted from the stored path.
// See "api docs/TDS API.md" §3, §3.1, §7, §8.

import { TDS_API_VERSION } from "./config";
import type { TdsContext } from "./context";
import { extractError, isSuccessBody, readStr, safeJsonParse } from "./parse";

export class TdsApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, path: string) {
    super(`TDS API ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = "TdsApiError";
    this.status = status;
    this.body = body;
  }
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

const enc = encodeURIComponent;

async function logCall(
  ctx: TdsContext,
  args: { method: string; logPath: string; status: number; ok: boolean; error: string | null; depositId?: string }
) {
  await ctx.admin
    .from("tds_api_log")
    .insert({
      tenant_id: ctx.tenantId,
      deposit_id: args.depositId ?? null,
      method: args.method,
      path: args.logPath,
      status_code: args.status || null,
      ok: args.ok,
      error: args.error,
    })
    .then(undefined, () => {});
}

/** JSON request/response with tolerant parsing + one tds_api_log row per call. */
async function requestJson(
  ctx: TdsContext,
  args: {
    method: "GET" | "POST";
    url: string;
    logPath: string;
    body?: unknown;
    depositId?: string;
  }
): Promise<{ status: number; ok: boolean; json: unknown }> {
  const { method, url, logPath, body, depositId } = args;
  let status = 0;
  let ok = false;
  let errorForLog: string | null = null;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body != null ? { "Content-Type": "application/json" } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    ok = res.ok;
    const text = await res.text();
    if (!ok) errorForLog = text.slice(0, 500);
    return { status, ok, json: safeJsonParse(text) };
  } catch (err) {
    errorForLog = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    throw err;
  } finally {
    await logCall(ctx, { method, logPath, status, ok, error: errorForLog, depositId });
  }
}

// ── CreateDeposit (async POST) ──────────────────────────────────────────────
export type CreateDepositResult = { success: boolean; batchId: string | null; error: string | null };

/**
 * POST the fat CreateDeposit body. `payload` must already contain member_id /
 * branch_id / api_key / region / scheme_type / tenancy[] (see buildCreateDepositPayload).
 * Returns success + batch_id for the follow-up status poll. Does not throw on a
 * validation failure — the caller records `success:false` + error on the row.
 */
export async function createTdsDeposit(
  ctx: TdsContext,
  payload: Record<string, unknown>,
  depositId?: string
): Promise<CreateDepositResult> {
  const logPath = `${TDS_API_VERSION}/CreateDeposit`;
  const { status, ok, json } = await requestJson(ctx, {
    method: "POST",
    url: `${ctx.apiBase}/${TDS_API_VERSION}/CreateDeposit`,
    logPath,
    body: payload,
    depositId,
  });
  const success = isSuccessBody(json);
  const batchId = readStr(json, "batch_id");
  const error = success
    ? null
    : extractError(json) ?? `TDS CreateDeposit failed (HTTP ${status || "?"}).`;
  return { success, batchId, error };
}

// ── CreateDepositStatus (poll) ──────────────────────────────────────────────
export type CreateDepositStatusResult = {
  success: boolean;
  status: "pending" | "created" | "failed" | null;
  dan: string | null;
  branchId: string | null;
  errors: unknown[] | null;
  warnings: unknown[] | null;
  error: string | null;
};

/**
 * GET /CreateDepositStatus/<member>/<branch>/<api_key>/<batch_id> (no version
 * segment). Throws TdsApiError on 401/403 so the poller can flag the connection.
 */
export async function getCreateDepositStatus(
  ctx: TdsContext,
  batchId: string,
  depositId?: string
): Promise<CreateDepositStatusResult> {
  const { memberId, branchId, apiKey } = ctx;
  const url = `${ctx.apiBase}/CreateDepositStatus/${enc(memberId)}/${enc(branchId)}/${enc(apiKey)}/${enc(batchId)}`;
  const logPath = `CreateDepositStatus/${memberId}/${branchId}/***/${batchId}`;
  const { status: httpStatus, json } = await requestJson(ctx, {
    method: "GET",
    url,
    logPath,
    depositId,
  });

  if (httpStatus === 401 || httpStatus === 403) {
    throw new TdsApiError(httpStatus, JSON.stringify(json), "CreateDepositStatus");
  }

  const raw = readStr(json, "status")?.toLowerCase() ?? null;
  const mapped = raw === "pending" || raw === "created" || raw === "failed" ? raw : null;
  const errors = Array.isArray((json as Record<string, unknown>)?.errors)
    ? ((json as Record<string, unknown>).errors as unknown[])
    : null;
  const warnings = Array.isArray((json as Record<string, unknown>)?.warnings)
    ? ((json as Record<string, unknown>).warnings as unknown[])
    : null;
  const success = isSuccessBody(json);

  return {
    success,
    status: mapped,
    dan: readStr(json, "dan"),
    branchId: readStr(json, "branch_id"),
    errors,
    warnings,
    error: mapped === "failed" || !success ? extractError(json) : null,
  };
}

// ── Deposit Protection Certificate (DPC) ────────────────────────────────────
/**
 * GET /dpc/<member>/<branch>/<api_key>/<dan> → PDF bytes. TDS returns a JSON
 * error body (not a PDF) on failure; we detect that and throw TdsApiError.
 */
export async function getDpcCertificate(
  ctx: TdsContext,
  dan: string,
  depositId?: string
): Promise<ArrayBuffer> {
  const { memberId, branchId, apiKey } = ctx;
  const url = `${ctx.apiBase}/dpc/${enc(memberId)}/${enc(branchId)}/${enc(apiKey)}/${enc(dan)}`;
  const logPath = `dpc/${memberId}/${branchId}/***/${dan}`;
  let status = 0;
  let ok = false;
  let errorForLog: string | null = null;
  try {
    const res = await fetch(url, { headers: { Accept: "application/pdf" } });
    status = res.status;
    ok = res.ok;
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || contentType.includes("json")) {
      const text = await res.text();
      errorForLog = text.slice(0, 500);
      const msg = extractError(safeJsonParse(text)) ?? text.slice(0, 300);
      throw new TdsApiError(res.status || 502, msg, "dpc");
    }
    return await res.arrayBuffer();
  } catch (err) {
    if (errorForLog === null) {
      errorForLog = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    }
    throw err;
  } finally {
    await logCall(ctx, { method: "GET", logPath, status, ok, error: errorForLog, depositId });
  }
}

// ── Repayment Request ───────────────────────────────────────────────────────
export type RepaymentResult = { success: boolean; error: string | null };

/**
 * POST /RaiseRepaymentRequest/. `body` must contain api_key / member_id /
 * branch_id / dan / tenancy_end_date / tenant_repayment(_type) / agent_repayment.
 */
export async function raiseRepaymentRequest(
  ctx: TdsContext,
  body: Record<string, unknown>,
  depositId?: string
): Promise<RepaymentResult> {
  const { status, json } = await requestJson(ctx, {
    method: "POST",
    url: `${ctx.apiBase}/RaiseRepaymentRequest/`,
    logPath: "RaiseRepaymentRequest/",
    body,
    depositId,
  });
  const success = isSuccessBody(json);
  const error = success ? null : extractError(json) ?? `TDS repayment request failed (HTTP ${status || "?"}).`;
  return { success, error };
}
