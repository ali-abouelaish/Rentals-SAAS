/**
 * Lead sources. Portal sources ("zoopla", "rightmove", or whatever an admin
 * names a Gmail platform) are free text copied from tenant_platform_configs.
 * The first-party sources below are written by Harbor itself and are
 * reserved: no platform config may claim one, because the AI assistant treats
 * first-party leads differently from Gmail-imported ones.
 */

export const WEBSITE_SOURCE = "website";
export const BUSINESS_CARD_SOURCE = "business_card";
export const FIRST_PARTY_SOURCES = [WEBSITE_SOURCE, BUSINESS_CARD_SOURCE] as const;

/** Prefix of every website lead's message_id (its dedupe key). */
export const WEBSITE_MESSAGE_ID_PREFIX = "web:";

/** Whether a proposed platform name collides with a reserved source. */
export function isReservedPlatformName(name: string): boolean {
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (FIRST_PARTY_SOURCES as readonly string[]).includes(key);
}

const LABELS: Record<string, string> = {
  [WEBSITE_SOURCE]: "Website",
  [BUSINESS_CARD_SOURCE]: "Business card",
  zoopla: "Zoopla",
  rightmove: "Rightmove",
};

/** Display label for a source value ("business_card" → "Business card"). */
export function leadSourceLabel(source: string): string {
  const known = LABELS[source.trim().toLowerCase()];
  if (known) return known;
  const spaced = source.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Unknown";
}

/**
 * Leads must have an email (the column is NOT NULL), so a lead that arrived
 * with only a phone number gets a placeholder address on this domain. The UI
 * hides it and shows the phone number instead.
 */
const PLACEHOLDER_EMAIL_DOMAIN = "@noreply.local";

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

export function placeholderEmail(prefix: string, id: string): string {
  return `${prefix}-${id}${PLACEHOLDER_EMAIL_DOMAIN}`;
}
