// Shared response parsers for the TDS Custodial API.
//
// TDS responses are inconsistent: success bodies variously use `isSuccess: true`,
// `success: true`, or the *string* `success: "true"`; error bodies use
// `success: "false"` plus an `errors` map/array (and CreateDeposit uses a
// singular `error` string). These helpers normalise whatever shape comes back so
// both credential verification (apiClient.ts) and the deposit lifecycle share one
// implementation.

/** Parse JSON leniently — a non-JSON / empty body yields null rather than throwing. */
export function safeJsonParse(text: string | null | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collect(obj: Record<string, unknown>): string | null {
  const parts = Object.entries(obj)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `${k}: ${v as string}`);
  return parts.length ? parts.join("; ") : null;
}

/**
 * Pull a human-readable message out of a TDS error body. Handles both the
 * `errors: { field: reason }` object shape and the `errors: [{ ... }]` array
 * shape (including status-endpoint entries like `{ name, field, value, code }`).
 */
export function extractError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const errors = b.errors;

  if (Array.isArray(errors)) {
    const msgs = errors
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const entry = e as Record<string, unknown>;
        // Status-endpoint errors carry name/field/value; prefer the value.
        if (typeof entry.value === "string") {
          const label = (entry.field ?? entry.name) as string | undefined;
          return label ? `${label}: ${entry.value}` : (entry.value as string);
        }
        return collect(entry);
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  } else if (errors && typeof errors === "object") {
    const msg = collect(errors as Record<string, unknown>);
    if (msg) return msg;
  }

  // CreateDeposit uses a singular `error` string on failure.
  if (typeof b.error === "string" && b.error) return b.error;
  return null;
}

/** True when the body reports success in any of the shapes TDS uses. */
export function isSuccessBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.isSuccess === true || b.success === true || b.success === "true";
}

/** Read a string-ish field, coercing numbers to strings; returns null when absent/blank. */
export function readStr(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as Record<string, unknown>)[key];
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}
