// DPS OAuth client-credentials token acquisition with in-process caching.
//
// Empirical contract (UAT, 2026-07-07 — the design notes document Basic-header
// auth, which the gateway rejects with 401 IDX12741): send client_id +
// client_secret in the x-www-form-urlencoded BODY with no Authorization
// header. Success is HTTP 201 with { access_token, token_type, expires_in }
// where expires_in = 1200 (20 minutes).
//
// The cache is a module-level Map — safe because the app runs as a single
// long-lived Node process (VPS + PM2), the same assumption the in-process
// node-cron scheduler already relies on. Tokens are keyed per tenant +
// environment and dropped DPS_TOKEN_TTL_SAFETY_MS before expiry.

import { dpsApiBase, DPS_TOKEN_PATH, DPS_TOKEN_TTL_SAFETY_MS, type DpsEnvironment } from "./config";
import { safeJsonParse, extractError } from "./parse";

export type DpsTokenCredentials = {
  environment: DpsEnvironment;
  clientId: string;
  clientSecret: string;
};

type CachedToken = { accessToken: string; expiresAt: number };

const tokenCache = new Map<string, CachedToken>();

function cacheKey(tenantId: string, environment: DpsEnvironment): string {
  return `${tenantId}:${environment}`;
}

/** Drop a tenant's cached token (used after a 401 on an API call). */
export function invalidateDpsToken(tenantId: string, environment: DpsEnvironment): void {
  tokenCache.delete(cacheKey(tenantId, environment));
}

export type DpsTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: string };

/**
 * Get a bearer token for the tenant, reusing the cached one while valid.
 * A failed fetch never caches; the next call retries from scratch.
 */
export async function getDpsToken(
  tenantId: string,
  creds: DpsTokenCredentials
): Promise<DpsTokenResult> {
  const key = cacheKey(tenantId, creds.environment);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, accessToken: cached.accessToken };
  }
  tokenCache.delete(key);

  const url = `${dpsApiBase(creds.environment)}${DPS_TOKEN_PATH}`;
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
      },
      body: form.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not reach DPS (${creds.environment}): ${message}` };
  }

  const body = safeJsonParse(await res.text());

  if (!res.ok) {
    return {
      ok: false,
      error:
        extractError(body) ??
        `DPS rejected the credentials (HTTP ${res.status}). Check client ID and client secret.`,
    };
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const accessToken = typeof b.access_token === "string" ? b.access_token : null;
  const expiresIn = typeof b.expires_in === "number" ? b.expires_in : 1200;
  if (!accessToken) {
    return { ok: false, error: "DPS token response did not contain an access_token." };
  }

  tokenCache.set(key, {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000 - DPS_TOKEN_TTL_SAFETY_MS,
  });
  return { ok: true, accessToken };
}
