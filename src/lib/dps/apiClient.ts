// DPS API client: credential verification + the two write endpoints
// (tenancy create, MarkForBankTransfer). See docs/dps-integration-plan.md for
// the verified request/response contract.
//
// There are no read endpoints, so verifying credentials = successfully
// acquiring a token. All success responses are HTTP 201 with the
// { requestId, response } envelope; validation failures are HTTP 400 with the
// { error: { details[] } } envelope (parse.ts).

import {
  dpsApiBase,
  DPS_CREATE_TENANCY_PATH,
  DPS_MARK_FOR_BANK_TRANSFER_PATH,
  type DpsEnvironment,
} from "./config";
import { getDpsToken, invalidateDpsToken, type DpsTokenCredentials } from "./token";
import {
  safeJsonParse,
  readResponse,
  readRequestId,
  extractError,
  extractFieldErrors,
  type DpsFieldError,
} from "./parse";

export type DpsCredentials = DpsTokenCredentials & {
  /** 7-digit DPS account id, sent as AgentLandlordId on tenancy creation. */
  agentLandlordId: string;
};

export type DpsVerifyResult = { ok: boolean; error?: string };

/**
 * Verify a client ID/secret pair by acquiring a token. The cache is dropped
 * first so changed credentials are really exercised, not served a token
 * acquired with the previous pair. Note this cannot validate agentLandlordId —
 * that is only exercised by tenancy creation.
 */
export async function verifyDpsCredentials(
  tenantId: string,
  creds: DpsTokenCredentials
): Promise<DpsVerifyResult> {
  invalidateDpsToken(tenantId, creds.environment);
  const token = await getDpsToken(tenantId, creds);
  return token.ok ? { ok: true } : { ok: false, error: token.error };
}

export type DpsCallResult = {
  ok: boolean;
  status: number;
  /** DPS support handle, present on success and failure. */
  requestId: string | null;
  /** The success envelope's `response` object. */
  response: Record<string, unknown> | null;
  /** Flattened error.details[] for inline form mapping. */
  fieldErrors: DpsFieldError[];
  /** One-line human-readable failure summary. */
  error: string | null;
};

/**
 * POST a JSON payload to a DPS endpoint with bearer auth. On a 401 the cached
 * token is dropped and the call retried once with a fresh token.
 */
async function dpsPost(
  tenantId: string,
  creds: DpsCredentials,
  path: string,
  payload: unknown,
  retried = false
): Promise<DpsCallResult> {
  const token = await getDpsToken(tenantId, creds);
  if (!token.ok) {
    return { ok: false, status: 0, requestId: null, response: null, fieldErrors: [], error: token.error };
  }

  let res: Response;
  try {
    res = await fetch(`${dpsApiBase(creds.environment)}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      requestId: null,
      response: null,
      fieldErrors: [],
      error: `Could not reach DPS (${creds.environment}): ${message}`,
    };
  }

  if (res.status === 401 && !retried) {
    invalidateDpsToken(tenantId, creds.environment);
    return dpsPost(tenantId, creds, path, payload, true);
  }

  const body = safeJsonParse(await res.text());
  const requestId = readRequestId(body) ?? res.headers.get("x-request-id");

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      requestId,
      response: null,
      fieldErrors: extractFieldErrors(body),
      error: extractError(body) ?? `DPS request failed (HTTP ${res.status}).`,
    };
  }

  return {
    ok: true,
    status: res.status,
    requestId,
    response: readResponse(body),
    fieldErrors: [],
    error: null,
  };
}

export type DpsCreateTenancyResult = DpsCallResult & { depositId: string | null };

/**
 * Create a tenancy (register the deposit). `payload` is the full documented
 * body, already validated and sanitised by the caller (mapDeposit.ts).
 * Success yields the 8-digit depositId.
 */
export async function createTenancy(
  tenantId: string,
  creds: DpsCredentials,
  payload: Record<string, unknown>
): Promise<DpsCreateTenancyResult> {
  const result = await dpsPost(tenantId, creds, DPS_CREATE_TENANCY_PATH, payload);
  const raw = result.response?.depositId;
  const depositId =
    typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : null;
  if (result.ok && !depositId) {
    return {
      ...result,
      ok: false,
      depositId: null,
      error: "DPS returned success but no depositId — contact DPS support with the requestId.",
    };
  }
  return { ...result, depositId };
}

export type DpsMarkForBankTransferResult = DpsCallResult & { paymentReference: string | null };

/**
 * Move a created tenancy from "Awaiting deposit payment" to "Awaiting bank
 * transfer". The returned paymentReference identifies the expected payment.
 */
export async function markForBankTransfer(
  tenantId: string,
  creds: DpsCredentials,
  args: { depositId: string; allocationReference: string }
): Promise<DpsMarkForBankTransferResult> {
  const result = await dpsPost(tenantId, creds, DPS_MARK_FOR_BANK_TRANSFER_PATH, {
    DepositId: args.depositId,
    AllocationReference: args.allocationReference,
  });
  const raw = result.response?.paymentReference;
  const paymentReference = typeof raw === "string" ? raw : null;
  return { ...result, paymentReference };
}
