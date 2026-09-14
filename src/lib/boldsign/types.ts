// Harbor Ops' own vocabulary for e-signing. The rest of the app speaks these
// types; only src/lib/boldsign/ knows about the SDK's models.

/** The Harbor Ops record a signature request was raised from. */
export type BoldSignEntityType = "contract" | "work_order" | "owner_statement";

/** Mirrors the CHECK on public.boldsign_documents.status. */
export type BoldSignDocumentStatus =
  | "awaiting_signature"
  | "partially_signed"
  | "completed"
  | "declined"
  | "expired"
  | "revoked"
  | "failed";

export const BOLDSIGN_ACTIVE_STATUSES: BoldSignDocumentStatus[] = [
  "awaiting_signature",
  "partially_signed",
];

export type SignatureFieldType = "Signature" | "Initial" | "DateSigned";

/**
 * A field box on the document.
 *
 * Coordinates are in PDF points with the origin at the page's TOP-LEFT, which
 * is how Harbor Ops already stores contract_template_fields — so a signature
 * box placed in the existing template editor maps straight through. The page
 * number is 1-based (contract_template_fields.page_index is 0-based; convert at
 * the boundary).
 */
export type SignatureFieldSpec = {
  type: SignatureFieldType;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isRequired?: boolean;
};

export type SignatureRequestSigner = {
  name: string;
  email: string;
  /** 1-based; only meaningful when the request enables signing order. */
  order?: number;
  fields: SignatureFieldSpec[];
};

export type SendForSignatureInput = {
  tenantId: string;
  entityType: BoldSignEntityType;
  entityId: string;
  /** Subject line of the signature request email. */
  title: string;
  message?: string;
  /** The generated document. Held in memory — these are small (tens of KB). */
  pdf: Buffer;
  fileName: string;
  signers: SignatureRequestSigner[];
  /** Per-agency brand (Phase 5). Null sends under the platform default. */
  brandId?: string | null;
  /** user_profiles.id of whoever pressed send. */
  sentBy?: string | null;
  enableSigningOrder?: boolean;
  expiryDays?: number;
};

export type SendForSignatureResult =
  | { ok: true; boldSignDocumentId: string; recordId: string }
  | {
      ok: false;
      error: string;
      /**
       * `out_of_envelopes` is handled specially by the UI — it opens the
       * purchase dialog rather than showing a toast, because unlike every
       * other failure here it is one the user can fix in place.
       */
      code?: "already_in_flight" | "out_of_envelopes";
    };

/**
 * What a "send for signature" server action returns to the UI.
 *
 * Shared so the two document types cannot drift, and so `code` is carried
 * consistently — the signing panel keys its out-of-envelopes handling off it,
 * and a missing code there would silently degrade to a plain toast.
 */
export type SendForSignatureActionResult =
  | { success: true; documentId: string }
  | { error: string; code?: "already_in_flight" | "out_of_envelopes" };
