export type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "file_upload"
  | "number";

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
};

export type BookingForm = {
  id: string;
  tenant_id: string;
  portfolio_id: string | null;
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
