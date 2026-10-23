/**
 * Enrichment shared by every lead source — the Gmail portal extractors and
 * website enquiries. No runtime imports, so anything can use it.
 */

/** Words that flag an enquiry as urgent ("hot") in the Leads list. */
export const HOT_KEYWORDS = ["urgent", "asap", "immediately", "call me", "today", "tomorrow"];

/** A dialable form of a phone number: digits and "+" only. */
export function cleanTelephone(telephone: string | null | undefined): string | null {
  if (!telephone) return null;
  return telephone.replace(/[^\d+]/g, "") || null;
}

/** True when any of the texts contains a hot keyword. */
export function isHotText(...texts: Array<string | null | undefined>): boolean {
  const lower = texts.filter(Boolean).join("\n").toLowerCase();
  return HOT_KEYWORDS.some((kw) => lower.includes(kw));
}
