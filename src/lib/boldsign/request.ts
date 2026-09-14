// Building the BoldSign send request.
//
// Split out of send.ts, which owns the database orchestration, so that the part
// with all the mapping decisions — field types, coordinates, signers, the
// sandbox flag, metadata — is pure and can be tested without a database or a
// network call. send.ts is then thin enough to reason about by eye.

import { DocumentSigner, FormField, Rectangle, SendForSign } from "boldsign";

import type {
  SendForSignatureInput,
  SignatureFieldSpec,
  SignatureFieldType,
  SignatureRequestSigner,
} from "./types";

/**
 * Map our field types onto the SDK's enum.
 *
 * Not a cast: the generated `.d.ts` declares FieldTypeEnum as a numeric enum
 * while the `.js` assigns string values ('Signature', …). Referencing the
 * members gives the correct runtime string and satisfies the declared type;
 * casting a plain string does neither.
 */
const FIELD_TYPES: Record<SignatureFieldType, FormField.FieldTypeEnum> = {
  Signature: FormField.FieldTypeEnum.Signature,
  Initial: FormField.FieldTypeEnum.Initial,
  DateSigned: FormField.FieldTypeEnum.DateSigned,
};

/**
 * Harbor Ops stores field boxes in PDF points with the origin at the page's
 * TOP-LEFT (contract_template_fields), and BoldSign's bounds use the same
 * convention — confirmed visually against the sandbox — so coordinates map
 * straight through with no y-flip.
 *
 * Values are rounded because BoldSign rejects fractional bounds.
 */
export function toFormField(field: SignatureFieldSpec): FormField {
  const bounds = new Rectangle();
  bounds.x = Math.round(field.x);
  bounds.y = Math.round(field.y);
  bounds.width = Math.round(field.width);
  bounds.height = Math.round(field.height);

  const formField = new FormField();
  formField.fieldType = FIELD_TYPES[field.type];
  formField.pageNumber = field.pageNumber;
  formField.bounds = bounds;
  formField.isRequired = field.isRequired ?? true;
  return formField;
}

export function toSigner(signer: SignatureRequestSigner): DocumentSigner {
  const documentSigner = new DocumentSigner();
  documentSigner.name = signer.name;
  documentSigner.emailAddress = signer.email;
  documentSigner.signerType = DocumentSigner.SignerTypeEnum.Signer;
  if (signer.order !== undefined) documentSigner.signerOrder = signer.order;
  documentSigner.formFields = signer.fields.map(toFormField);
  return documentSigner;
}

/**
 * Reject obviously unsendable requests before anything is written or sent.
 * Returns the reason, or null when the request is fit to send.
 */
export function validateSendInput(input: SendForSignatureInput): string | null {
  if (input.signers.length === 0) return "A signature request needs at least one signer.";
  for (const signer of input.signers) {
    if (!signer.email?.trim()) return `Signer "${signer.name}" has no email address.`;
    if (signer.fields.length === 0) {
      // Without a field there is nothing to sign: BoldSign would accept the
      // document and the signer would be unable to complete it.
      return `Signer "${signer.name}" has no signature field placed on the document.`;
    }
  }
  if (input.pdf.length === 0) return "The document is empty.";
  return null;
}

export type SendContext = {
  brandId: string | null;
  onBehalfOf: string | null;
  isSandbox: boolean;
};

export function buildSendRequest(
  input: SendForSignatureInput,
  context: SendContext
): SendForSign {
  const request = new SendForSign();
  request.title = input.title;
  if (input.message) request.message = input.message;
  request.signers = input.signers.map(toSigner);
  request.files = [
    { value: input.pdf, options: { filename: input.fileName, contentType: "application/pdf" } },
  ];

  if (context.brandId) request.brandId = context.brandId;
  // Sends from the agency's own verified mailbox rather than the platform's.
  if (context.onBehalfOf) request.onBehalfOf = context.onBehalfOf;
  if (input.enableSigningOrder) request.enableSigningOrder = true;
  if (input.expiryDays !== undefined) request.expiryDays = input.expiryDays;

  // Keeps sandbox traffic out of the agency's real document quota and, more
  // importantly, stops a misconfigured environment issuing binding agreements.
  request.isSandbox = context.isSandbox;

  // Echoed back on every webhook event, so a delivery can be correlated even if
  // the document id lookup fails.
  request.metaData = {
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
  };

  return request;
}
