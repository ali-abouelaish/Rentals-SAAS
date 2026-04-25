export type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "file_upload"
  | "number"
  | "info";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone number",
  date: "Date",
  select: "Dropdown (select one)",
  checkbox: "Checkbox (yes/no)",
  file_upload: "File upload",
  number: "Number",
  info: "Info / note block",
};

export type BookingForm = {
  id: string;
  tenant_id: string;
  portfolio_id: string | null;
  bank_details_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  public_slug: string;
  created_at: string;
  // joined
  portfolio?: { name: string; color: string } | null;
  questions?: FormQuestion[];
  tenant?: {
    name: string;
    branding: { brand_name: string | null; logo_url: string | null } | null;
  } | null;
};

export type PortfolioBankDetails = {
  id: string;
  tenant_id: string;
  portfolio_id: string;
  label: string;
  account_holder_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  bank_name: string | null;
  payment_reference_hint: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type FormQuestion = {
  id: string;
  tenant_id: string;
  form_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
};
