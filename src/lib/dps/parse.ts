// Response parsers for the DPS API.
//
// Unlike TDS's inconsistent bodies, DPS uses two fixed envelopes (verified
// against UAT 2026-07-07):
//
//   success (HTTP 201): { "requestId": "...", "response": { ...payload } }
//   error   (HTTP 400): { "error": { "code", "message", "target", "requestId",
//                          "details": [ { "field": "Tenants[0].LastName",
//                            "errors": [ { "code", "message" } ] } ] } }
//
// details[].field uses dotted request paths, which the protect wizard maps
// back onto its own form fields for inline display.

export type DpsFieldError = {
  /** Dotted path into the request payload, e.g. "Tenants[0].LastName". */
  field: string;
  code: string;
  message: string;
};

/** Parse JSON leniently — a non-JSON / empty body yields null rather than throwing. */
export function safeJsonParse(text: string | null | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** The `response` object from a success envelope, or null. */
export function readResponse(body: unknown): Record<string, unknown> | null {
  return asRecord(asRecord(body)?.response);
}

/** The requestId DPS attaches to both success and error envelopes (support handle). */
export function readRequestId(body: unknown): string | null {
  const b = asRecord(body);
  if (!b) return null;
  if (typeof b.requestId === "string") return b.requestId;
  const err = asRecord(b.error);
  return typeof err?.requestId === "string" ? err.requestId : null;
}

/** Flatten error.details[] into per-field errors for inline form display. */
export function extractFieldErrors(body: unknown): DpsFieldError[] {
  const details = asRecord(asRecord(body)?.error)?.details;
  if (!Array.isArray(details)) return [];
  const out: DpsFieldError[] = [];
  for (const d of details) {
    const detail = asRecord(d);
    if (!detail) continue;
    const field = typeof detail.field === "string" ? detail.field : "";
    const errors = Array.isArray(detail.errors) ? detail.errors : [];
    for (const e of errors) {
      const entry = asRecord(e);
      if (!entry) continue;
      out.push({
        field,
        code: typeof entry.code === "string" ? entry.code : "Unknown",
        message: typeof entry.message === "string" ? entry.message : "Invalid value",
      });
    }
  }
  return out;
}

/** One human-readable summary line for toasts / last_error columns. */
export function extractError(body: unknown): string | null {
  const err = asRecord(asRecord(body)?.error);
  if (!err) return null;
  const fieldErrors = extractFieldErrors(body);
  if (fieldErrors.length) {
    return fieldErrors.map((e) => `${e.field || "request"}: ${e.message}`).join("; ");
  }
  if (typeof err.message === "string" && err.message) {
    return typeof err.code === "string" && err.code ? `${err.code}: ${err.message}` : err.message;
  }
  return null;
}
