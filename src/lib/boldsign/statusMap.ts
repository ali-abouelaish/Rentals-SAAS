// Mapping BoldSign webhook events onto boldsign_documents.status.
//
// Pure and dependency-free so it can be unit-tested directly, and so the
// out-of-order rules below are stated in one place rather than scattered
// through the handler.

import type { BoldSignDocumentStatus } from "./types";

/**
 * Statuses that end the document's life. Once a document is in one of these,
 * nothing moves it back — see shouldApplyStatus().
 */
export const TERMINAL_STATUSES: readonly BoldSignDocumentStatus[] = [
  "completed",
  "declined",
  "expired",
  "revoked",
] as const;

/**
 * BoldSign event type -> the status it implies. Null means "this event carries
 * no status change" — it is still recorded, just not acted on.
 *
 * 'Signed' is per-signer: on a single-signer document it is immediately
 * followed by 'Completed'. Treating it as partially_signed is therefore correct
 * for both cases, because Completed overwrites it.
 */
export function mapEventToStatus(eventType: string): BoldSignDocumentStatus | null {
  switch (eventType) {
    case "Sent":
      return "awaiting_signature";
    case "Signed":
      return "partially_signed";
    case "Completed":
      return "completed";
    case "Declined":
      return "declined";
    case "Expired":
      return "expired";
    case "Revoked":
      return "revoked";
    case "SendFailed":
      return "failed";

    // Recorded but not status-bearing: Viewed, Reassigned, Reminder,
    // AuthenticationFailed, DeliveryFailed, and the template / sender-identity
    // / identity-verification families.
    default:
      return null;
  }
}

export function isTerminal(status: BoldSignDocumentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Whether a newly-received status should overwrite the stored one.
 *
 * Webhooks are not ordered. A 'Signed' event delayed in delivery can arrive
 * after the 'Completed' that followed it, which would otherwise walk an
 * executed agreement back to partially_signed. Terminal statuses are therefore
 * sticky.
 *
 * The one exception is a repeat of the same terminal status, which is allowed
 * so a redelivered Completed can still trigger the artifact download if the
 * first attempt failed.
 */
export function shouldApplyStatus(
  current: BoldSignDocumentStatus,
  next: BoldSignDocumentStatus
): boolean {
  if (current === next) return true;
  if (isTerminal(current)) return false;
  return true;
}

/**
 * What a received event should do to a stored document.
 *
 * Separated from the handler in events.ts so the decision — which is where the
 * interesting rules live — can be tested without a database or a network call.
 * The handler is then only the effects: read the row, apply this, write it back.
 */
export type EventPlan =
  | { action: "no_status_change" }
  | { action: "ignore"; reason: "terminal" }
  | { action: "apply"; status: BoldSignDocumentStatus; fetchArtifacts: boolean };

export function planEventApplication(params: {
  eventType: string;
  currentStatus: BoldSignDocumentStatus;
  hasSignedPdf: boolean;
  hasAuditTrail: boolean;
}): EventPlan {
  const status = mapEventToStatus(params.eventType);
  if (!status) return { action: "no_status_change" };

  if (!shouldApplyStatus(params.currentStatus, status)) {
    return { action: "ignore", reason: "terminal" };
  }

  // Artefacts are fetched only on completion, and only when they are not
  // already stored — so a redelivered Completed is cheap, but one whose first
  // download failed still retries.
  const fetchArtifacts =
    status === "completed" && !(params.hasSignedPdf && params.hasAuditTrail);

  return { action: "apply", status, fetchArtifacts };
}
