import { createSign } from "crypto";

const EB_BASE_URL = "https://api.enablebanking.com";

export type EbAspsp = {
  name: string;
  country: string;
  logo?: string;
  psu_types?: string[];
  auth_methods?: unknown[];
};

export type EbAccount = {
  uid: string;
  account_id?: { iban?: string; other?: { identification?: string } };
  name?: string;
  product?: string;
  currency?: string;
};

export type EbTransaction = {
  entry_reference?: string;
  transaction_id?: string;
  booking_date?: string;
  value_date?: string;
  transaction_amount?: { amount?: string; currency?: string };
  credit_debit_indicator?: "CRDT" | "DBIT";
  status?: string;
  debtor?: { name?: string };
  debtor_account?: { iban?: string };
  remittance_information?: string[];
};

type StartAuthResponse = { url: string; authorization_id: string };
type SessionResponse = {
  session_id: string;
  accounts: EbAccount[];
  access?: { valid_until?: string };
  status?: string;
};
type SessionStatusResponse = {
  session_id: string;
  status: string;
  access?: { valid_until?: string };
  accounts?: EbAccount[];
};

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Sign an RS256 JWT for the EB application using EB_PRIVATE_KEY / EB_APP_ID.
 * Cached for ~55 minutes — JWT lifetime is 1h on the wire, refresh a little
 * early so an in-flight request never picks up an already-expired token.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

function signEbToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const kid = process.env.EB_APP_ID;
  const rawKey = process.env.EB_PRIVATE_KEY;
  if (!kid || !rawKey) {
    throw new Error("Enable Banking not configured: set EB_APP_ID and EB_PRIVATE_KEY");
  }
  // Allow \n-escaped newlines in .env values
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;

  const header = { typ: "JWT", alg: "RS256", kid };
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = base64url(signer.sign(privateKey));
  const token = `${signingInput}.${signature}`;

  cachedToken = { token, expiresAt: now + 3600 };
  return token;
}

async function ebFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = signEbToken();
  const url = path.startsWith("http") ? path : `${EB_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...((init.headers as Record<string, string>) ?? {})
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Enable Banking ${res.status} ${res.statusText} on ${path}: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function getAspsps(
  country = "GB",
  psuType?: "business" | "personal"
): Promise<EbAspsp[]> {
  const params = new URLSearchParams({ country });
  if (psuType) params.set("psu_type", psuType);
  const data = await ebFetch<{ aspsps?: EbAspsp[] }>(`/aspsps?${params.toString()}`);
  return data.aspsps ?? [];
}

export async function startAuth(
  aspspName: string,
  aspspCountry: string,
  redirectUrl: string,
  state: string
): Promise<StartAuthResponse> {
  // EB requires an ISO timestamp for access.valid_until — sandbox sessions
  // accept up to ~180 days. 90 days is a sensible demo default.
  const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const body = {
    access: { valid_until: validUntil },
    aspsp: { name: aspspName, country: aspspCountry },
    state,
    redirect_url: redirectUrl,
    psu_type: "business"
  };
  return ebFetch<StartAuthResponse>("/auth", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function authorizeSession(code: string): Promise<SessionResponse> {
  return ebFetch<SessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function getTransactions(
  accountUid: string,
  dateFrom?: string
): Promise<EbTransaction[]> {
  const params = new URLSearchParams({ transaction_status: "BOOK" });
  if (dateFrom) params.set("date_from", dateFrom);
  const all: EbTransaction[] = [];
  let next: string | null = `/accounts/${encodeURIComponent(accountUid)}/transactions?${params.toString()}`;
  // EB paginates with `continuation_key`; cap at 10 pages for a sandbox demo.
  for (let page = 0; page < 10 && next; page++) {
    const data: { transactions?: EbTransaction[]; continuation_key?: string } =
      await ebFetch(next);
    if (data.transactions?.length) all.push(...data.transactions);
    if (data.continuation_key) {
      const p = new URLSearchParams(params);
      p.set("continuation_key", data.continuation_key);
      next = `/accounts/${encodeURIComponent(accountUid)}/transactions?${p.toString()}`;
    } else {
      next = null;
    }
  }
  return all;
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  return ebFetch<SessionStatusResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
}
