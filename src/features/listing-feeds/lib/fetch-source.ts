/**
 * Resolves a user-supplied spreadsheet link to raw bytes.
 *
 * Three source kinds are supported:
 *   google_sheet — pulled through the sheet's CSV export endpoint, which needs
 *                  no credentials as long as link sharing is on. When a service
 *                  account is configured we use the Sheets API instead, so
 *                  private sheets shared with that account also work.
 *   csv_url      — any hosted .csv fetched directly.
 *   xlsx_url     — any hosted .xlsx/.xls fetched directly.
 *
 * Because the URL comes from a tenant user and the fetch runs server-side, the
 * target is screened for SSRF before any request goes out (see `assertSafeUrl`).
 */

import dns from "node:dns/promises";
import net from "node:net";
import {
  SHEETS_SCOPE,
  googleJwt,
  hasServiceAccount,
  readServiceAccount,
  serviceAccountEmail,
} from "./google-auth";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * How the pasted link is fetched. Derived from the URL on every read rather
 * than stored — the landlord record holds only the link itself.
 */
export type FeedSourceKind = "google_sheet" | "csv_url" | "xlsx_url";

/** Raised for problems the user can fix; the message is shown to them verbatim. */
export class FeedSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedSourceError";
  }
}

// ------------------------------------------------------------------
// URL parsing
// ------------------------------------------------------------------

export type ParsedSource = {
  kind: FeedSourceKind;
  sheetId: string | null;
  sheetGid: string | null;
  /** True for the `/d/e/<id>/pubhtml` "publish to web" form. */
  published: boolean;
  fetchUrl: string;
};

/**
 * Work out what the pasted link actually is and where to fetch it from.
 * Throws `FeedSourceError` for anything we cannot turn into a spreadsheet.
 */
export function parseSourceUrl(rawUrl: string): ParsedSource {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new FeedSourceError("That does not look like a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FeedSourceError("Only http:// and https:// links are supported.");
  }

  const isGoogleSheets =
    /(^|\.)docs\.google\.com$/i.test(url.hostname) && url.pathname.includes("/spreadsheets/");

  if (isGoogleSheets) {
    // gid can live in the query string or the fragment, depending on how the
    // user copied the link. Default to 0 — the first tab.
    const gidFromQuery = url.searchParams.get("gid");
    const gidFromHash = /(?:^|[#&])gid=(\d+)/.exec(url.hash)?.[1] ?? null;
    const gid = gidFromQuery ?? gidFromHash ?? "0";

    // "Publish to web" links: /spreadsheets/d/e/<publishId>/pubhtml
    const publishedMatch = /\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/.exec(url.pathname);
    if (publishedMatch) {
      const publishId = publishedMatch[1];
      return {
        kind: "google_sheet",
        sheetId: publishId,
        sheetGid: gid,
        published: true,
        fetchUrl: `https://docs.google.com/spreadsheets/d/e/${publishId}/pub?output=csv&gid=${gid}`,
      };
    }

    const idMatch = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(url.pathname);
    if (!idMatch) {
      throw new FeedSourceError(
        "Could not find a spreadsheet ID in that link. Copy the URL from the browser address bar while the sheet is open."
      );
    }
    const sheetId = idMatch[1];
    return {
      kind: "google_sheet",
      sheetId,
      sheetGid: gid,
      published: false,
      fetchUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    };
  }

  // Not Google — fall back to the file extension on the path.
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".csv")) {
    return { kind: "csv_url", sheetId: null, sheetGid: null, published: false, fetchUrl: url.toString() };
  }
  if (path.endsWith(".xlsx") || path.endsWith(".xls") || path.endsWith(".xlsm")) {
    return { kind: "xlsx_url", sheetId: null, sheetGid: null, published: false, fetchUrl: url.toString() };
  }

  throw new FeedSourceError(
    "Unrecognised link. Paste a Google Sheets URL, or a direct link to a .csv or .xlsx file."
  );
}

// ------------------------------------------------------------------
// SSRF screening
// ------------------------------------------------------------------

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe80")) return true; // link-local
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — screen the embedded address.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(lower);
  if (mapped) return isPrivateAddress(mapped[1]);
  return false;
}

/**
 * Reject links that point back inside our own network. Resolution happens here
 * and again inside fetch, so a hostile DNS server could in principle answer
 * differently the second time; that residual TOCTOU gap is accepted — this
 * screens the realistic cases (localhost, LAN hosts, 169.254 metadata).
 */
async function assertSafeUrl(target: string): Promise<void> {
  const url = new URL(target);
  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FeedSourceError("That address is not reachable from the server.");
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new FeedSourceError("That address is not reachable from the server.");
    }
    return;
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new FeedSourceError(`Could not resolve ${host}. Check the link is correct.`);
  }
  if (records.some((r) => isPrivateAddress(r.address))) {
    throw new FeedSourceError("That address is not reachable from the server.");
  }
}

// ------------------------------------------------------------------
// Fetching
// ------------------------------------------------------------------

/** Read a response body, aborting if it exceeds `MAX_BYTES`. */
async function readCapped(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    throw new FeedSourceError("That file is larger than 25MB. Split the sheet or trim old rows.");
  }

  const body = response.body;
  if (!body) return Buffer.alloc(0);

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  // Streamed so a server that omits content-length cannot make us buffer
  // unbounded data.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new FeedSourceError("That file is larger than 25MB. Split the sheet or trim old rows.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function httpFetch(target: string): Promise<{ buffer: Buffer; contentType: string }> {
  await assertSafeUrl(target);

  let response: Response;
  try {
    response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some hosts serve an HTML landing page to unknown agents.
        "user-agent": "HarborOps-ListingFeed/1.0",
        accept: "text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
      },
    });
  } catch (err) {
    if (err instanceof FeedSourceError) throw err;
    const reason = err instanceof Error && err.name === "TimeoutError"
      ? "The source took longer than 30 seconds to respond."
      : "Could not reach the source URL.";
    throw new FeedSourceError(reason);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new FeedSourceError(
        "The source refused access (HTTP " +
          response.status +
          "). If this is a Google Sheet, set link sharing to “Anyone with the link — Viewer”."
      );
    }
    if (response.status === 404) {
      throw new FeedSourceError("The source returned 404 — the sheet or file no longer exists at that link.");
    }
    throw new FeedSourceError(`The source returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const buffer = await readCapped(response);
  return { buffer, contentType };
}

/**
 * Google redirects private sheets to a sign-in page, which arrives as a 200
 * with an HTML body rather than an error status. Detect that so the user gets
 * the real instruction instead of a parser failure.
 */
function looksLikeHtml(buffer: Buffer, contentType: string): boolean {
  if (contentType.toLowerCase().includes("text/html")) return true;
  const head = buffer.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

// ------------------------------------------------------------------
// Google Sheets API (optional, for private sheets)
// ------------------------------------------------------------------

async function fetchViaSheetsApi(
  sheetId: string,
  gid: string | null
): Promise<{ rows: string[][]; links: (string | null)[][]; sheetName: string | null }> {
  const creds = readServiceAccount();
  if (!creds) throw new FeedSourceError("No Google service account is configured on this server.");

  // Imported lazily: googleapis is a heavy dependency and only this path needs it.
  const { google } = await import("googleapis");
  const auth = await googleJwt([SHEETS_SCOPE]);
  const sheets = google.sheets({ version: "v4", auth });

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: "sheets.properties" });
  } catch (err) {
    const status = (err as { code?: number })?.code;
    if (status === 403 || status === 404) {
      throw new FeedSourceError(
        `The service account cannot open that sheet. Share it (Viewer) with ${creds.client_email}, or set link sharing to “Anyone with the link”.`
      );
    }
    throw new FeedSourceError("Google Sheets API request failed.");
  }

  const tabs = meta.data.sheets ?? [];
  const wanted = gid === null ? undefined : Number(gid);
  const tab =
    tabs.find((s) => s.properties?.sheetId === wanted) ?? tabs[0];
  const title = tab?.properties?.title ?? null;
  if (!title) throw new FeedSourceError("That spreadsheet has no readable tabs.");

  // includeGridData gives us the cell hyperlinks that CSV export throws away.
  // `hyperlink` covers cells linked via Insert → Link; `formulaValue` catches
  // =HYPERLINK("…","label"). Fields are narrowed hard because grid data for a
  // whole sheet is otherwise a very large response.
  let grid;
  try {
    grid = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      // A1 notation: a bare tab name breaks as soon as it contains a space
      // ("Availability 2026") or an apostrophe, and the API then rejects the
      // range. Always quote, doubling any internal apostrophe.
      ranges: [`'${title.replace(/'/g, "''")}'`],
      includeGridData: true,
      fields:
        "sheets(data(rowData(values(formattedValue,hyperlink,userEnteredValue(formulaValue)))))",
    });
  } catch {
    throw new FeedSourceError("Google Sheets API request failed while reading the sheet.");
  }

  const rowData = grid.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const rows: string[][] = [];
  const links: (string | null)[][] = [];

  for (const row of rowData) {
    const cells = row.values ?? [];
    rows.push(cells.map((cell) => String(cell.formattedValue ?? "")));
    links.push(
      cells.map((cell) => {
        if (cell.hyperlink) return cell.hyperlink;
        const formula = cell.userEnteredValue?.formulaValue;
        if (formula) {
          const match = /=\s*HYPERLINK\s*\(\s*"([^"]+)"/i.exec(formula);
          if (match) return match[1];
        }
        return null;
      })
    );
  }

  return { rows, links, sheetName: title };
}

// ------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------

export type SourceResult =
  | {
      via: "http";
      parsed: ParsedSource;
      format: "csv" | "xlsx";
      buffer: Buffer;
      sheetName: string | null;
      /**
       * Set when a service account was configured and the Sheets API was tried
       * but failed, so we fell back to CSV export and lost every hyperlink.
       * Surfaced to the user — this is invisible otherwise.
       */
      apiError?: string | null;
    }
  | {
      via: "sheets-api";
      parsed: ParsedSource;
      rows: string[][];
      links: (string | null)[][];
      sheetName: string | null;
    };

/**
 * Fetch a spreadsheet source.
 *
 * For Google Sheets the API path is preferred whenever a service account is
 * configured, because it is the only way to see cell hyperlinks — CSV export
 * returns a linked cell's display text ("Pictures") and silently drops its
 * target, which breaks link and photo-folder columns. Without credentials we
 * fall back to CSV export, which still works for everything except hyperlinks.
 */
export async function fetchSource(rawUrl: string): Promise<SourceResult> {
  const parsed = parseSourceUrl(rawUrl);

  if (parsed.kind !== "google_sheet") {
    const { buffer, contentType } = await httpFetch(parsed.fetchUrl);
    if (buffer.length === 0) throw new FeedSourceError("The source returned an empty file.");
    if (parsed.kind === "csv_url" && looksLikeHtml(buffer, contentType)) {
      throw new FeedSourceError(
        "That link returned a web page rather than a CSV file. Use the direct download link."
      );
    }
    return {
      via: "http",
      parsed,
      format: parsed.kind === "xlsx_url" ? "xlsx" : "csv",
      buffer,
      sheetName: null,
    };
  }

  // Google Sheet. Prefer the API when we have credentials — it is the only path
  // that preserves hyperlinks. CSV export is the fallback, not the default.
  let apiError: string | null = null;
  if (parsed.sheetId && !parsed.published && hasServiceAccount()) {
    try {
      const { rows, links, sheetName } = await fetchViaSheetsApi(parsed.sheetId, parsed.sheetGid);
      return { via: "sheets-api", parsed, rows, links, sheetName };
    } catch (err) {
      // A sheet that is public but not shared with the service account still
      // reads fine over CSV export, so fall through rather than failing — but
      // record why, because this fallback silently costs us every hyperlink.
      if (!(err instanceof FeedSourceError)) throw err;
      apiError = err.message;
      console.warn("[listing-feeds] Sheets API read failed, falling back to CSV export:", err.message);
    }
  }

  let exportError: FeedSourceError | null = null;
  try {
    const { buffer, contentType } = await httpFetch(parsed.fetchUrl);
    if (buffer.length > 0 && !looksLikeHtml(buffer, contentType)) {
      return { via: "http", parsed, format: "csv", buffer, sheetName: null, apiError };
    }
    exportError = new FeedSourceError(
      "That Google Sheet is not shared publicly. Open it, click Share, and set “Anyone with the link” to Viewer — then try again."
    );
  } catch (err) {
    exportError = err instanceof FeedSourceError ? err : new FeedSourceError("Could not read that Google Sheet.");
  }

  const email = serviceAccountEmail();
  if (email && exportError) {
    throw new FeedSourceError(`${exportError.message} Or share it (Viewer) with ${email}.`);
  }
  throw exportError ?? new FeedSourceError("Could not read that Google Sheet.");
}
