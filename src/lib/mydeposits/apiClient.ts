// mydeposits API client: per-tenant auth context (load + decrypt + refresh
// tokens) and a logged fetch wrapper. Server-only — uses the service-role
// admin client to read/rotate tokens.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./encrypt";
import { refreshTokens } from "./oauth";
import { mdUrls, resolveMdEnvironment, type MdEnvironment } from "./config";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type MdContext = {
  tenantId: string;
  environment: MdEnvironment;
  accessToken: string;
  apiBase: string;
  admin: AdminClient;
};

export class MdApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, path: string) {
    super(`mydeposits API ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = "MdApiError";
    this.status = status;
    this.body = body;
  }
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * Load the tenant's connection, decrypt the access token, refresh it (and
 * persist the rotated pair) if it expires within the 5-minute buffer.
 * Throws if the tenant has no connection.
 */
export async function getMdContext(tenantId: string): Promise<MdContext> {
  const admin = createSupabaseAdminClient();
  const { data: conn, error } = await admin
    .from("mydeposits_connections")
    .select("environment, access_token, refresh_token, token_expiry")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !conn) {
    throw new Error(`No mydeposits connection for tenant ${tenantId}`);
  }

  const environment = (conn.environment as MdEnvironment) ?? resolveMdEnvironment();
  let accessToken = decryptToken(conn.access_token);

  const expiry = new Date(conn.token_expiry).getTime();
  if (expiry - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
    const refreshed = await refreshTokens(environment, decryptToken(conn.refresh_token));
    accessToken = refreshed.accessToken;
    await admin
      .from("mydeposits_connections")
      .update({
        access_token: encryptToken(refreshed.accessToken),
        refresh_token: encryptToken(refreshed.refreshToken),
        token_expiry: refreshed.expiry.toISOString(),
      })
      .eq("tenant_id", tenantId);
  }

  return {
    tenantId,
    environment,
    accessToken,
    apiBase: mdUrls(environment).apiBase,
    admin,
  };
}

type MdFetchOptions = RequestInit & {
  /** Optional protection id to attach to the api-log row. */
  protectionId?: string;
  /** Return the raw Response (for binary bodies like certificates). */
  raw?: boolean;
};

/**
 * Fetch against the mydeposits API with Bearer auth, tolerant JSON parsing,
 * and one mydeposits_api_log row per call. Throws MdApiError on non-2xx.
 */
export async function mdFetch<T>(ctx: MdContext, path: string, init: MdFetchOptions = {}): Promise<T> {
  const { protectionId, raw, ...requestInit } = init;
  const url = path.startsWith("http") ? path : `${ctx.apiBase}${path}`;
  const method = (requestInit.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.accessToken}`,
    Accept: raw ? "*/*" : "application/json",
    ...((requestInit.headers as Record<string, string>) ?? {}),
  };
  if (requestInit.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let status = 0;
  let ok = false;
  let errorForLog: string | null = null;
  try {
    const res = await fetch(url, { ...requestInit, headers });
    status = res.status;
    ok = res.ok;

    if (raw) {
      if (!res.ok) {
        const body = await res.text();
        errorForLog = body.slice(0, 500);
        throw new MdApiError(res.status, body, path);
      }
      return res as unknown as T;
    }

    const text = await res.text();
    if (!res.ok) {
      errorForLog = text.slice(0, 500);
      throw new MdApiError(res.status, text, path);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (err) {
    if (errorForLog === null) {
      errorForLog = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    }
    throw err;
  } finally {
    // Best-effort logging — never let a logging failure mask the real result.
    await ctx.admin
      .from("mydeposits_api_log")
      .insert({
        tenant_id: ctx.tenantId,
        protection_id: protectionId ?? null,
        method,
        path,
        status_code: status || null,
        ok,
        error: errorForLog,
      })
      .then(undefined, () => {});
  }
}
