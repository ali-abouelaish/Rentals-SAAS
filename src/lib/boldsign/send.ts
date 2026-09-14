// Sending a document for signature.
//
// Flow is reserve → send → confirm, not send → persist:
//
//   1. Insert a boldsign_documents row with a null document id. This claims the
//      one-active-per-entity unique index.
//   2. Call BoldSign.
//   3. Write the returned documentId back onto the reserved row.
//
// The ordering matters. Sending first would mean two concurrent "send for
// signature" clicks both raise real documents and email the signer two copies
// of the same tenancy agreement, with the collision only detected afterwards.
// Reserving first makes the second click fail before anything is sent.
//
// If step 2 fails the row is marked 'failed' rather than deleted, so the
// attempt stays visible in the UI and the entity isn't left silently unsent.
//
// An ENVELOPE is spent between reserving and sending. Not before: the
// one-active-per-entity check is free, and charging for a duplicate click that
// was about to be rejected anyway would be indefensible. Not after either,
// since by then the document is gone and the charge can no longer be refused.
// Every path that fails after the envelope is taken refunds it.
//
// Request construction lives in request.ts, which is pure and tested; this file
// is deliberately only the orchestration around it.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAgencyIdentity } from "./brands";
import { boldSignErrorMessage, documentApi } from "./client";
import { isBoldSignSandbox } from "./config";
import { buildSendRequest, validateSendInput } from "./request";
import { consumeEnvelope, refundEnvelope } from "@/lib/envelopes/balance";
import type { SendForSignatureInput, SendForSignatureResult } from "./types";

/** Postgres unique_violation. */
const PG_UNIQUE_VIOLATION = "23505";

export async function sendForSignature(
  input: SendForSignatureInput
): Promise<SendForSignatureResult> {
  const invalid = validateSendInput(input);
  if (invalid) return { ok: false, error: invalid };

  const admin = createSupabaseAdminClient();
  const isSandbox = isBoldSignSandbox();

  // Which agency identity this sends under. An explicit brandId wins; otherwise
  // resolve the sending agency's own. Both may be null — BoldSign falls back to
  // the account default, so an agency that hasn't been provisioned yet still
  // sends rather than being blocked.
  const identity = await resolveAgencyIdentity(input.tenantId);
  const brandId = input.brandId ?? identity.brandId;

  // ── 1. Reserve ───────────────────────────────────────────────────
  const { data: reserved, error: reserveError } = await admin
    .from("boldsign_documents")
    .insert({
      tenant_id: input.tenantId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      brand_id: brandId,
      status: "awaiting_signature",
      is_sandbox: isSandbox,
      sent_by: input.sentBy ?? null,
    })
    .select("id")
    .single();

  if (reserveError || !reserved) {
    if (reserveError?.code === PG_UNIQUE_VIOLATION) {
      return {
        ok: false,
        code: "already_in_flight",
        error: "This record already has a signature request awaiting signature.",
      };
    }
    return { ok: false, error: reserveError?.message ?? "Could not create the signing record." };
  }

  // ── 2. Spend an envelope ─────────────────────────────────────────
  const envelope = await consumeEnvelope(input.tenantId);

  if (!envelope.ok) {
    // Release the reservation. The partial unique index only covers
    // in-flight states, so marking it failed frees the entity to be sent
    // again once the agency has topped up — deleting the row would work too,
    // but a delete that fails would block the entity permanently.
    await admin
      .from("boldsign_documents")
      .update({
        status: "failed",
        status_detail:
          envelope.reason === "out_of_envelopes"
            ? "No signing envelopes remaining."
            : envelope.error,
        last_event_at: new Date().toISOString(),
      })
      .eq("id", reserved.id);

    if (envelope.reason === "out_of_envelopes") {
      return {
        ok: false,
        code: "out_of_envelopes",
        error: "You have no signing envelopes left. Buy more to send this document.",
      };
    }
    return { ok: false, error: envelope.error };
  }

  // ── 3. Send ──────────────────────────────────────────────────────
  const request = buildSendRequest(input, {
    brandId,
    onBehalfOf: identity.onBehalfOf,
    isSandbox,
  });

  let boldSignDocumentId: string | null = null;
  try {
    const created = await documentApi().sendDocument(request);
    boldSignDocumentId = created.documentId ?? null;
    if (!boldSignDocumentId) throw new Error("BoldSign returned no documentId.");
  } catch (err) {
    const message = boldSignErrorMessage(err);
    await admin
      .from("boldsign_documents")
      .update({ status: "failed", status_detail: message, last_event_at: new Date().toISOString() })
      .eq("id", reserved.id);
    // Nothing was delivered, so nothing should have been charged. Being billed
    // for a document that never arrived costs far more in trust than the
    // envelope is worth.
    await refundEnvelope(input.tenantId, envelope.source);
    return { ok: false, error: message };
  }

  // ── 4. Confirm ───────────────────────────────────────────────────
  const { error: confirmError } = await admin
    .from("boldsign_documents")
    .update({ boldsign_document_id: boldSignDocumentId })
    .eq("id", reserved.id);

  if (confirmError) {
    // The document is real and the signer has been emailed, so this must not
    // read as a failure — but without the id, webhooks can't correlate. Log
    // loudly with the id so it can be reattached by hand.
    console.error("[boldsign] sent but failed to store documentId", {
      recordId: reserved.id,
      boldSignDocumentId,
      error: confirmError.message,
    });
  }

  return { ok: true, boldSignDocumentId, recordId: reserved.id };
}
