import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { Form, FormQuestion, FormSubmission, FormAnswer } from "../domain/types";

export async function getForms(): Promise<Form[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("forms")
    .select("*, portfolio:portfolios(id, name, color), questions:form_questions(*)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Form[]).map((f) => ({
    ...f,
    questions: ((f.questions ?? []) as FormQuestion[])
      .map((q) => ({
        ...q,
        options: q.options
          ? typeof q.options === "string"
            ? JSON.parse(q.options)
            : q.options
          : null,
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getActiveForms(): Promise<Form[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("forms")
    .select("id, name, description, public_slug, portfolio_id, is_active, tenant_id, created_at, updated_at, portfolio:portfolios(id, name, color)")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Form[];
}

export async function getFormWithQuestions(id: string): Promise<Form | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: formData, error: formError } = await supabase
    .from("forms")
    .select("*, portfolio:portfolios(id, name, color)")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (formError || !formData) {
    if (formError) console.error("[getFormWithQuestions] form fetch error:", formError.message);
    return null;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("form_questions")
    .select("*")
    .eq("form_id", id)
    .order("sort_order", { ascending: true });

  if (questionsError) {
    console.error("[getFormWithQuestions] questions fetch error:", questionsError.message);
  }

  return {
    ...formData,
    questions: ((questions ?? []) as FormQuestion[]).map((q) => ({
      ...q,
      options: q.options
        ? typeof q.options === "string"
          ? JSON.parse(q.options)
          : q.options
        : null,
    })),
  } as unknown as Form;
}

export async function getFormSubmissions(formId: string): Promise<FormSubmission[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("form_submissions")
    .select("*, answers:form_answers(*)")
    .eq("form_id", formId)
    .eq("tenant_id", profile.tenant_id)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FormSubmission[];
}

export async function getFormAnswer(submissionId: string): Promise<FormAnswer[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("form_answers")
    .select("*")
    .eq("submission_id", submissionId)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  return (data ?? []) as FormAnswer[];
}
