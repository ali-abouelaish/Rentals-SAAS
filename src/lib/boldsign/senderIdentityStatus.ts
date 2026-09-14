/**
 * Interpreting BoldSign's sender-identity status.
 *
 * Dependency-free so `node --test` can load it. The mapping is the risky part
 * of the sender-identity flow: getting it wrong in the permissive direction
 * means passing `onBehalfOf` for an identity BoldSign hasn't approved, and the
 * send is rejected outright — a tenancy agreement that silently doesn't go.
 *
 * So the rule is: ONLY an explicitly approved status counts. Their vocabulary
 * is undocumented and can gain values; anything unrecognised is treated as not
 * yet usable rather than assumed good.
 */

export type SenderIdentityState =
  /** No identity has been requested for this agency. */
  | "none"
  /** Requested; the agency has not completed BoldSign's verification yet. */
  | "pending"
  /** Verified — safe to send on behalf of. */
  | "verified"
  /** The agency (or BoldSign) refused it. Needs a fresh request. */
  | "declined"
  /** A status string we don't recognise. Treated as unusable. */
  | "unknown";

/**
 * Map BoldSign's raw status string to what the UI and the send path need.
 *
 * Matching is case-insensitive and trimmed, because the API has returned
 * inconsistent casing and a padded value would otherwise fall through to
 * "unknown" and strand a perfectly good identity.
 */
export function senderIdentityState(raw: string | null | undefined): SenderIdentityState {
  if (raw === null || raw === undefined) return "none";
  const value = raw.trim().toLowerCase();
  if (value === "") return "none";

  // "approved" is BoldSign's term; "verified" and "active" are accepted as
  // synonyms in case the vocabulary shifts, since all three unambiguously mean
  // the identity is usable.
  if (value === "approved" || value === "verified" || value === "active") return "verified";
  if (value === "pending" || value === "requested" || value === "invited") return "pending";
  if (value === "declined" || value === "rejected" || value === "revoked") return "declined";
  return "unknown";
}

/**
 * Whether an identity may be passed as `onBehalfOf` at send time.
 *
 * Deliberately requires BOTH: a status that reads as verified, and the
 * verification timestamp we recorded when we saw it. Either alone has failed
 * in practice — a stale row can hold an old timestamp after BoldSign revoked
 * the identity, and a status refreshed without persisting the timestamp means
 * we never actually confirmed it ourselves.
 */
export function canSendOnBehalfOf(row: {
  sender_identity_email: string | null;
  sender_identity_status: string | null;
  sender_identity_verified_at: string | null;
}): boolean {
  if (!row.sender_identity_email) return false;
  if (!row.sender_identity_verified_at) return false;
  return senderIdentityState(row.sender_identity_status) === "verified";
}

/**
 * Whether the agency's Harbor Ops branding has drifted from what was last
 * pushed to BoldSign.
 *
 * The snapshot columns exist only for this. Without it every page load would
 * either re-upload the logo (slow, and pointless) or silently keep sending
 * documents with branding the agency changed months ago.
 */
export function brandIsStale(
  snapshot: {
    brand_name: string | null;
    email_display_name: string | null;
    logo_source_url: string | null;
    primary_color: string | null;
  },
  current: { displayName: string; logoUrl: string | null; primaryColor: string | null }
): boolean {
  return (
    snapshot.brand_name !== current.displayName ||
    snapshot.email_display_name !== current.displayName ||
    snapshot.logo_source_url !== current.logoUrl ||
    snapshot.primary_color !== current.primaryColor
  );
}
