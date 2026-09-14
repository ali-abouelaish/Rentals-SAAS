// Turning a thrown BoldSign SDK error into one readable line.
//
// Pure — no env, no server-only — so the shapes below can be unit-tested. They
// need to be, because the SDK throws three different things depending on how
// the request failed:
//
//   1. HttpError, but ONLY for the status codes each generated method declares
//      (200/401/403). `body` holds the parsed response.
//   2. A raw AxiosError for every other status — including 400, the most common
//      failure when a send is rejected for validation. Here there is no `body`
//      at all and `message` is just "Request failed with status code 400";
//      the detail lives in `response.data`.
//   3. A plain Error for transport failures (DNS, timeout, TLS), with no
//      response at all.
//
// On top of that, the download endpoints use responseType "arraybuffer", so
// their error bodies arrive as raw bytes: a Buffer holding
// {"error":"Forbidden"} rather than an object with an `error` property.
//
// Missing any of these turns a diagnosable failure into a wall of numbers or a
// bare status code, which is exactly what happened before this module existed.

/** Pull BoldSign's error text out of a response body in any of its shapes. */
export function extractErrorDetail(body: unknown): string | null {
  if (body === null || body === undefined) return null;

  if (Buffer.isBuffer(body)) {
    const text = body.toString("utf8").trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error?.trim() || parsed.message?.trim() || text;
    } catch {
      return text;
    }
  }

  if (typeof body === "string") {
    const text = body.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error?.trim() || parsed.message?.trim() || text;
    } catch {
      return text;
    }
  }

  if (typeof body !== "object") return null;

  const record = body as { error?: unknown; message?: unknown; title?: unknown };
  for (const value of [record.error, record.message, record.title]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

type ResponseLike = { status?: number; data?: unknown };
type ErrorLike = {
  statusCode?: number;
  body?: unknown;
  response?: ResponseLike;
  message?: unknown;
};

/**
 * Flatten any BoldSign failure into one line, always including the HTTP status
 * when known — callers match on it (see the retry rule in artifacts.ts).
 */
export function boldSignErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return "BoldSign request failed.";

  const candidate = err as ErrorLike;
  const status = candidate.statusCode ?? candidate.response?.status;

  // `body` first (HttpError), then `response.data` (raw AxiosError).
  const detail =
    extractErrorDetail(candidate.body) ?? extractErrorDetail(candidate.response?.data);

  if (detail) return status ? `${status}: ${detail}` : detail;
  if (status) return `BoldSign request failed with HTTP ${status}.`;

  if (err instanceof Error && err.message) return err.message;
  if (typeof candidate.message === "string" && candidate.message) return candidate.message;
  return String(err);
}
