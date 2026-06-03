export type FieldSource =
  | "booking_response"
  | "property"
  | "unit"
  | "landlord"
  | "agency"
  | "booking"
  | "pm_tenant"
  | "manual"
  | "computed";

export type FieldFormat = "text" | "date" | "currency_gbp" | "number" | "multiline";
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
  source: FieldSource;
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
  source: FieldSource;
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
