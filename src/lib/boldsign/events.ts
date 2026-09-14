// Turning a verified webhook event into a status change.
//
// Idempotency comes from three layers, because webhook delivery guarantees are
// "at least once", not "exactly once":
//
//   1. boldsign_document_events.event_id is unique — a redelivery can't create
//      a second row (enforced in the route handler).
//   2. Processing is assignment, not mutation: it sets the status the event
//      implies rather than advancing a state machine, so running it twice lands
//      in the same place.
//   3. Terminal statuses are sticky (statusMap.shouldApplyStatus), so an
//      out-of-order 'Signed' arriving after 'Completed' can't walk an executed
//      agreement backwards.
//
// Artefact download is also idempotent — deterministic paths, upsert uploads —
// so a Completed event that failed halfway can simply be replayed.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { storeSignedArtifacts } from "./artifacts";
import { boldSignErrorMessage } from "./client";
import { planEventApplication } from "./statusMap";
import type { BoldSignDocumentStatus, BoldSignEntityType } from "./types";

export type ProcessResult =
  | { ok: true; outcome: "applied" | "ignored" | "unknown_document" | "no_status_change" }
  | { ok: false; error: string };

type DocumentRow = {
  id: string;
  tenant_id: string;
  entity_type: BoldSignEntityType;
  entity_id: string;
  status: BoldSignDocumentStatus;
  signed_pdf_path: string | null;
  audit_trail_path: string | null;
};

/**
 * Mirror a coarse signing outcome onto the record the document was raised from.
 *
 * Only contracts are mirrored, and only on completion. The other two types keep
 * their signing state in boldsign_documents alone:
 *   - maintenance_jobs has no signing-related status to set; 'resolved' means
 *     the work is done, which a signature does not establish.
 *   - owner_statements.status is draft/approved/sent/void, where 'approved'
 *     means internally approved before sending. Reusing it for "the owner
 *     signed" would overload an existing meaning.
 * Inventing states for either is a product decision, not an integration one.
 */
async function mirrorToHostRecord(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  document: DocumentRow,
  status: BoldSignDocumentStatus
): Promise<void> {
  if (document.entity_type !== "contract" || status !== "completed") return;

  const { error } = await admin
    .from("property_contracts")
    .update({ status: "signed", signing_method: "boldsign" })
    .eq("id", document.entity_id)
    .eq("tenant_id", document.tenant_id);

  if (error) {
    // Non-fatal: the signing record is already correct and holds the artefacts.
    // Surfacing this as a failure would make BoldSign retry an event that has
    // otherwise been fully handled.
    console.error("[boldsign] could not mirror status onto contract", {
      contractId: document.entity_id,
      error: error.message,
    });
  }
}

export async function processBoldSignEvent(params: {
  eventType: string;
  boldSignDocumentId: string | null;
}): Promise<ProcessResult> {
  const { eventType, boldSignDocumentId } = params;

  if (!boldSignDocumentId) return { ok: true, outcome: "unknown_document" };

  const admin = createSupabaseAdminClient();

  const { data: document, error: lookupError } = await admin
    .from("boldsign_documents")
    .select("id, tenant_id, entity_type, entity_id, status, signed_pdf_path, audit_trail_path")
    .eq("boldsign_document_id", boldSignDocumentId)
    .maybeSingle<DocumentRow>();

  if (lookupError) return { ok: false, error: lookupError.message };

  if (!document) {
    // Sent from another system, or from a Harbor Ops instance pointed at the
    // same BoldSign account. Nothing to update; the raw event is still stored.
    console.warn("[boldsign] event for an unknown document", { boldSignDocumentId, eventType });
    return { ok: true, outcome: "unknown_document" };
  }

  const plan = planEventApplication({
    eventType,
    currentStatus: document.status,
    hasSignedPdf: Boolean(document.signed_pdf_path),
    hasAuditTrail: Boolean(document.audit_trail_path),
  });

  if (plan.action === "no_status_change") return { ok: true, outcome: "no_status_change" };

  if (plan.action === "ignore") {
    console.log("[boldsign] ignoring out-of-order event", {
      boldSignDocumentId,
      current: document.status,
      eventType,
    });
    return { ok: true, outcome: "ignored" };
  }

  const { status } = plan;
  const update: Record<string, unknown> = {
    status,
    last_event_at: new Date().toISOString(),
  };

  if (status === "completed") {
    update.completed_at = new Date().toISOString();

    if (plan.fetchArtifacts) {
      try {
        const stored = await storeSignedArtifacts(document.tenant_id, boldSignDocumentId);
        update.signed_pdf_path = stored.signedPdfPath;
        update.audit_trail_path = stored.auditTrailPath;
      } catch (err) {
        // Deliberately a failure: the status is not advanced to completed
        // without its artefacts, so BoldSign retries and we get another chance.
        // Recording completion while silently losing the executed PDF would be
        // the worse outcome.
        //
        // boldSignErrorMessage, not err.message: on the download endpoints the
        // SDK's message is a JSON dump of the raw response bytes, which would
        // land in process_error as an unreadable array of numbers.
        const message = boldSignErrorMessage(err);
        console.error("[boldsign] could not store signed artefacts", {
          boldSignDocumentId,
          error: message,
        });
        return { ok: false, error: message };
      }
    }
  }

  const { error: updateError } = await admin
    .from("boldsign_documents")
    .update(update)
    .eq("id", document.id);

  if (updateError) return { ok: false, error: updateError.message };

  await mirrorToHostRecord(admin, document, status);

  return { ok: true, outcome: "applied" };
}
