import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { Form, FormQuestion, FormSubmission, FormAnswer } from "../domain/types";

export async function getForms(): Promise<Form[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Form[];
}

export async function getFormWithQuestions(id: string): Promise<Form | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("forms")
    .select("*, questions:form_questions(*)")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .order("sort_order", { referencedTable: "form_questions", ascending: true })
    .single();

  if (error || !data) return null;

  return {
    ...data,
    questions: ((data.questions as FormQuestion[]) ?? []).map((q) => ({
      ...q,
      options: q.options
        ? typeof q.options === "string"
          ? JSON.parse(q.options)
          : q.options
        : null,
    })),
  } as Form;
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
