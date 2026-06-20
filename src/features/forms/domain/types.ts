import type { QuestionType } from "@/lib/types/question";

export type { QuestionType };

export type Form = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  public_slug: string;
  portfolio_id: string | null;
  created_at: string;
  updated_at: string;
  questions?: FormQuestion[];
  portfolio?: { id: string; name: string; color: string } | null;
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

export type FormSubmission = {
  id: string;
  tenant_id: string;
  form_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  submitted_at: string;
  answers?: FormAnswer[];
};

export type FormAnswer = {
  id: string;
  tenant_id: string;
  submission_id: string;
  question_id: string;
  answer_text: string | null;
};

export type ParsedQuestion = {
  label: string;
  type: QuestionType;
  options: string[] | null;
  is_required: boolean;
};
