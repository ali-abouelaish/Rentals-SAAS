// Turning a template's e-signature fields into BoldSign signers.
//
// Pure, so the grouping and coordinate rules are unit-tested rather than
// discovered when a real tenancy agreement goes out with the landlord's
// signature box on the tenant's copy.
//
// Coordinates need no conversion: contract_template_fields already stores them
// in PDF points with a top-left origin, which is exactly what BoldSign's form
// field bounds use. Only the page index shifts — the editor is 0-based, BoldSign
// is 1-based.

import type { SignatureFieldSpec, SignatureFieldType } from "@/lib/boldsign/types";

import type { FieldKind, SignerRole } from "../templates/domain/types";

/** The slice of a template field this needs. */
export type TemplateSignatureField = {
  field_kind: FieldKind;
  signer_role: SignerRole | null;
  page_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RoleFields = { role: SignerRole; fields: SignatureFieldSpec[] };

const KIND_TO_FIELD_TYPE: Record<Exclude<FieldKind, "data">, SignatureFieldType> = {
  signature: "Signature",
  initial: "Initial",
  date_signed: "DateSigned",
};

/**
 * Signing order. A tenancy is signed by the tenant first, then countersigned by
 * the landlord; a guarantor signs alongside the tenant they are guaranteeing.
 * Roles absent from the template are simply skipped.
 */
const ROLE_ORDER: SignerRole[] = ["tenant", "guarantor", "landlord"];

/**
 * Group a template's e-signature fields by the party who signs them.
 *
 * Returns roles in signing order, each with its own fields. Data fields and
 * fields with no signer are dropped — the latter can't happen through the
 * editor, which requires a signer, but a hand-edited row shouldn't put an
 * unattributed signature box on a contract.
 */
export function groupSignatureFieldsByRole(
  fields: TemplateSignatureField[]
): RoleFields[] {
  const byRole = new Map<SignerRole, SignatureFieldSpec[]>();

  for (const field of fields) {
    // Defaulted for the window between deploying this and applying the
    // migration that adds the column; assigned to a local so it narrows.
    const kind = field.field_kind ?? "data";
    if (kind === "data" || !field.signer_role) continue;

    const spec: SignatureFieldSpec = {
      type: KIND_TO_FIELD_TYPE[kind],
      // The editor stores 0-based page indexes; BoldSign pages are 1-based.
      pageNumber: field.page_index + 1,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      isRequired: true,
    };

    const existing = byRole.get(field.signer_role);
    if (existing) existing.push(spec);
    else byRole.set(field.signer_role, [spec]);
  }

  return ROLE_ORDER.filter((role) => byRole.has(role)).map((role) => ({
    role,
    fields: byRole.get(role)!,
  }));
}
