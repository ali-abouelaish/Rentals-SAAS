export type FieldSource =
  | "booking_response"
  | "property"
  | "unit"
  | "landlord"
  | "agency"
  | "booking"
  | "pm_tenant"
  | "manual"
  | "computed"
  | "contract";

export type FieldFormat = "text" | "date" | "currency_gbp" | "number" | "multiline";

/**
 * Server-action result. Thrown errors lose their message in production builds
 * (Next replaces it with a generic one), so every action the UI calls returns
 * its failure instead.
 */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** The contract terms a PDF is generated with. Money is whole pounds. */
export type ContractTerms = {
  start_date: string;
  expiry_date: string | null;
  rent_pcm: number;
  deposit: number;
  collection_date: number | null;
  deposit_scheme: "dps" | "mydeposits" | "tds" | "none" | null;
};

/** Stored on property_contracts.generation_inputs so regeneration is lossless. */
export type GenerationInputs = {
  template_id: string;
  booking_id: string;
  terms: ContractTerms;
  manual_values: Record<string, string>;
  generated_at: string;
};

/** A manual field as the generation form needs it — one entry per manual key. */
export type ManualFieldPrompt = {
  key: string;
  label: string;
  format: FieldFormat;
  default_value: string | null;
};

/**
 * What a field on the template does.
 *
 * 'data' is the original behaviour — resolve a value and stamp it into the PDF.
 * The rest are e-signature fields: never stamped, instead handed to BoldSign as
 * form fields at send time so the signer fills them in.
 */
export type FieldKind = "data" | "signature" | "initial" | "date_signed";

/** Which party signs an e-signature field. */
export type SignerRole = "tenant" | "landlord" | "guarantor";

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  guarantor: "Guarantor",
};

export const FIELD_KIND_LABELS: Record<FieldKind, string> = {
  data: "Merge field",
  signature: "Signature",
  initial: "Initials",
  date_signed: "Date signed",
};

/** True for the kinds BoldSign fills in rather than the PDF stamper. */
export function isSignatureKind(kind: FieldKind): boolean {
  return kind !== "data";
}
export type FieldFontWeight = "normal" | "bold";
export type FieldTextAlign = "left" | "center" | "right";

export type PageSize = { width: number; height: number };

export type ContractTemplate = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  portfolio_id: string | null;
  source_pdf_path: string;
  page_count: number;
  page_sizes: PageSize[];
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ContractTemplateField = {
  id: string;
  tenant_id: string;
  template_id: string;
  label: string;
  page_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  field_kind: FieldKind;
  /** Set for e-signature kinds, null for data fields. */
  signer_role: SignerRole | null;
  /** Null for e-signature fields, which bind to no data. */
  source: FieldSource | null;
  question_id: string | null;
  data_key: string | null;
  manual_key: string | null;
  manual_default: string | null;
  format: FieldFormat;
  font_size: number;
  font_weight: FieldFontWeight;
  text_align: FieldTextAlign;
  truncate_overflow: boolean;
  ai_confidence: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ContractTemplateWithFields = ContractTemplate & {
  fields: ContractTemplateField[];
  source_signed_url: string;
};

// Shape used by the editor UI (id may be a temporary client-side string until saved).
export type TemplateFieldInput = {
  id?: string;
  label: string;
  page_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  field_kind: FieldKind;
  signer_role: SignerRole | null;
  source: FieldSource | null;
  question_id: string | null;
  data_key: string | null;
  manual_key: string | null;
  manual_default: string | null;
  format: FieldFormat;
  font_size: number;
  font_weight: FieldFontWeight;
  text_align: FieldTextAlign;
  truncate_overflow: boolean;
  ai_confidence: number | null;
  sort_order: number;
};

export type AiFieldProposal = {
  page_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  suggested_source: FieldSource;
  suggested_key: string | null;
  suggested_question_id: string | null;
  ai_confidence: number;
};
