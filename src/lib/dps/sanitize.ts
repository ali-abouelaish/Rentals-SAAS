// Outbound string sanitiser for the DPS API.
//
// DPS accepts alphanumerics, spaces and a fixed whitelist of Latin-1
// characters (Create Tenancy design note §4.2, Table 3 — ¡ through ÿ).
// Anything outside that — em-dashes, curly quotes, ellipses, emoji — fails
// with "InvalidCharacters". User-entered text routinely contains smart
// punctuation (pasted from Word/phones), so we transliterate the common cases
// and strip the rest rather than bounce the whole submission.

const REPLACEMENTS: Record<string, string> = {
  "‘": "'", // ‘
  "’": "'", // ’
  "‚": "'", // ‚
  "“": '"', // “
  "”": '"', // ”
  "„": '"', // „
  "–": "-", // – en dash
  "—": "-", // — em dash
  "―": "-", // ― horizontal bar
  "…": "...", // …
  " ": " ", // non-breaking space
  "•": "-", // • bullet
};

// Printable ASCII plus the Latin-1 block Table 3 whitelists (¡ U+00A1 … ÿ U+00FF).
const ALLOWED = /[\x20-\x7E¡-ÿ]/;

/** Transliterate smart punctuation, drop anything DPS would reject, collapse whitespace. */
export function sanitizeDpsText(value: string): string {
  let out = "";
  for (const ch of value) {
    const replaced = REPLACEMENTS[ch];
    if (replaced !== undefined) {
      out += replaced;
    } else if (ALLOWED.test(ch)) {
      out += ch;
    }
    // else: dropped
  }
  return out.replace(/\s+/g, " ").trim();
}
