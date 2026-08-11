/**
 * Shared Google service-account credentials for the spreadsheet importer.
 *
 * Two consumers with different requirements:
 *   Sheets — optional. A sheet shared as "anyone with the link" is read through
 *            its credential-free CSV export endpoint; the service account is
 *            only needed for private sheets.
 *   Drive  — required. There is no credential-free way to list a folder's
 *            contents, so image import does not work without this configured.
 */

import fs from "node:fs";
import path from "node:path";

export type ServiceAccount = { client_email: string; private_key: string };

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

/**
 * Why credentials are unusable. Every one of these used to collapse into a bare
 * `null`, which made "Not configured on this server" the answer to four
 * genuinely different problems.
 */
export type ServiceAccountStatus =
  | { ok: true; account: ServiceAccount; source: string }
  | { ok: false; reason: string; fix: string };

/** Env var names checked, in precedence order. */
const ENV_VARS = ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"] as const;

/**
 * Key file checked when no env var is set. Dropping the downloaded key into the
 * project root is the obvious thing to do, and `service_account.json` is
 * already gitignored, so support it rather than silently ignoring it.
 */
const DEFAULT_KEY_FILE = "service_account.json";

/** Where the credentials came from, and the raw text. */
function locateCredentials(): { source: string; value: string } | null {
  for (const name of ENV_VARS) {
    const value = (process.env[name] ?? "").trim();
    if (value) return { source: name, value };
  }

  const explicitPath = (process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "").trim();
  const candidates = explicitPath
    ? [explicitPath]
    : [path.join(process.cwd(), DEFAULT_KEY_FILE)];

  for (const candidate of candidates) {
    try {
      const value = fs.readFileSync(candidate, "utf8").trim();
      if (value) return { source: candidate, value };
    } catch {
      // Missing or unreadable — fall through to the next candidate.
    }
  }

  return null;
}

export function serviceAccountStatus(): ServiceAccountStatus {
  const found = locateCredentials();

  if (!found) {
    return {
      ok: false,
      reason: `No credentials found. Checked ${ENV_VARS.join(", ")}, GOOGLE_SERVICE_ACCOUNT_FILE, and ./${DEFAULT_KEY_FILE}.`,
      fix: `Put the service-account key JSON at ./${DEFAULT_KEY_FILE}, or set GOOGLE_SERVICE_ACCOUNT_JSON (base64-encoded), then RESTART the server — env and cwd are read at startup.`,
    };
  }

  const { source: name, value } = found;

  let json = value;
  if (!value.startsWith("{")) {
    // Not raw JSON, so it should be base64. A service-account key contains
    // literal newlines in private_key, which break .env parsing unless the
    // whole value is base64-encoded or quoted — this is the usual mistake.
    let decoded: string;
    try {
      decoded = Buffer.from(value, "base64").toString("utf8");
    } catch {
      decoded = "";
    }
    if (!decoded.trim().startsWith("{")) {
      return {
        ok: false,
        reason: `${name} is set (${value.length} chars) but is neither JSON nor valid base64-encoded JSON.`,
        fix: "The key contains newlines that .env cannot hold unquoted. Base64-encode the whole file and use that single-line value.",
      };
    }
    json = decoded;
  }

  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return {
      ok: false,
      reason: `${name} could not be parsed as JSON: ${err instanceof Error ? err.message : "invalid JSON"}.`,
      fix: "If you pasted the key directly, its embedded newlines have corrupted the value. Base64-encode the file instead.",
    };
  }

  if (!parsed.client_email || !parsed.private_key) {
    return {
      ok: false,
      reason: `${name} parsed as JSON but has no ${!parsed.client_email ? "client_email" : "private_key"}.`,
      fix: "Use the full service-account key JSON downloaded from Google Cloud, not an OAuth client or API-key file.",
    };
  }

  return {
    ok: true,
    account: { client_email: parsed.client_email, private_key: parsed.private_key },
    source: name,
  };
}

export function readServiceAccount(): ServiceAccount | null {
  const status = serviceAccountStatus();
  return status.ok ? status.account : null;
}

export function hasServiceAccount(): boolean {
  return readServiceAccount() !== null;
}

/** Service-account email, so error messages can name who to share with. */
export function serviceAccountEmail(): string | null {
  return readServiceAccount()?.client_email ?? null;
}

/**
 * Build an authenticated JWT client for the given scopes. Imported lazily by
 * callers because googleapis is a heavy dependency.
 */
export async function googleJwt(scopes: string[]) {
  const creds = readServiceAccount();
  if (!creds) throw new Error("No Google service account is configured on this server.");

  const { google } = await import("googleapis");
  return new google.auth.JWT({
    email: creds.client_email,
    // Env vars carry the key with literal \n sequences; the JWT client needs
    // real newlines.
    key: creds.private_key.replace(/\\n/g, "\n"),
    scopes,
  });
}
