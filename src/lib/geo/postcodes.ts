/**
 * UK postcode helpers, backed by postcodes.io (free, keyless). Server-only in
 * practice: callers run in route handlers and server actions.
 */

/**
 * Full UK postcodes ("SW1A 1AA", "m14 5rt", "B33 8TH"), with or without the
 * space. Outward code: area letters + district digit(s), optionally a trailing
 * letter; inward code: digit + two letters.
 */
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/** The first full UK postcode in free text, normalised to "AB1 2CD", or null. */
export function extractUkPostcode(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = UK_POSTCODE.exec(text);
  if (!match) return null;
  return `${match[1]} ${match[2]}`.toUpperCase();
}

/** Coordinates for a postcode, or null on any failure — never throws. */
export async function geocodePostcode(
  postcode: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { latitude?: number; longitude?: number };
    };
    if (data.result?.latitude != null && data.result?.longitude != null) {
      return { latitude: data.result.latitude, longitude: data.result.longitude };
    }
    return null;
  } catch {
    return null;
  }
}
