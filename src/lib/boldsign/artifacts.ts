// Downloading the signed PDF and audit trail on completion, and storing both
// in the private signed_documents bucket.
//
// These are the artefacts that matter legally: the executed agreement and the
// certificate of who signed what, when, and from where. They are fetched once,
// on the Completed event, rather than linked to — BoldSign is the system of
// record only while the document is in flight.

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { boldSignErrorMessage, documentApi } from "./client";

export const SIGNED_DOCUMENTS_BUCKET = "signed_documents";

export type StoredArtifacts = {
  signedPdfPath: string;
  auditTrailPath: string;
};

/**
 * BoldSign can answer 403 for a document it has just accepted — observed
 * during Phase 2, where getProperties failed immediately after sendDocument and
 * succeeded moments later against the same key. Treat an early 403/404 as
 * propagation delay rather than a permanent failure.
 *
 * Note that 403 is also what downloadAuditLog returns for a document that is
 * still in progress (verified against the sandbox), which is why this function
 * is only ever called from the Completed handler. If both artefacts can't be
 * fetched the event is failed rather than partially applied, so BoldSign
 * redelivers and the download is retried — recording an agreement as executed
 * while silently losing its audit trail would be the worse outcome.
 */
const RETRYABLE = /\b(403|404)\b/;
const RETRY_DELAYS_MS = [500, 2000, 5000];

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = boldSignErrorMessage(err);
      if (!RETRYABLE.test(message) || attempt === RETRY_DELAYS_MS.length) break;
      console.warn(`[boldsign] ${label} returned ${message}, retrying`, { attempt });
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError;
}

/** axios returns a Buffer for arraybuffer responses in Node, but be defensive. */
function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("BoldSign returned a download in an unexpected format.");
}

/** A PDF always starts with %PDF-. Catches an error page saved as a document. */
function assertPdf(buffer: Buffer, label: string): void {
  if (buffer.length === 0) throw new Error(`BoldSign returned an empty ${label}.`);
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error(`BoldSign returned a ${label} that is not a PDF.`);
  }
}

/**
 * Fetch and store both artefacts. Idempotent: paths are deterministic and
 * uploads use upsert, so a redelivered Completed event overwrites rather than
 * duplicating.
 */
export async function storeSignedArtifacts(
  tenantId: string,
  boldSignDocumentId: string
): Promise<StoredArtifacts> {
  const api = documentApi();

  const [signedRaw, auditRaw] = await Promise.all([
    withRetry("downloadDocument", () => api.downloadDocument(boldSignDocumentId)),
    withRetry("downloadAuditLog", () => api.downloadAuditLog(boldSignDocumentId)),
  ]);

  const signedPdf = toBuffer(signedRaw);
  const auditTrail = toBuffer(auditRaw);
  assertPdf(signedPdf, "signed document");
  assertPdf(auditTrail, "audit trail");

  // Tenant id first so the storage RLS policy can read it off the path prefix.
  const prefix = `${tenantId}/${boldSignDocumentId}`;
  const signedPdfPath = `${prefix}/signed.pdf`;
  const auditTrailPath = `${prefix}/audit-trail.pdf`;

  const admin = createSupabaseAdminClient();
  for (const [path, body, label] of [
    [signedPdfPath, signedPdf, "signed document"],
    [auditTrailPath, auditTrail, "audit trail"],
  ] as const) {
    const { error } = await admin.storage
      .from(SIGNED_DOCUMENTS_BUCKET)
      // Buffer, not Uint8Array: Supabase Storage in the Node runtime mis-handles
      // a bare Uint8Array and stores a file that won't open. Mirrors the
      // contract-generation and invoice flows.
      .upload(path, body, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`Could not store the ${label}: ${error.message}`);
  }

  return { signedPdfPath, auditTrailPath };
}
