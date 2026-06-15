"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { FormQuestionValues } from "../domain/schemas";
import type { ParsedQuestion } from "../domain/types";

export async function createFormQuestion(formId: string, values: FormQuestionValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (!form) throw new Error("Form not found");

  const { data, error } = await supabase
    .from("form_questions")
    .insert({
      tenant_id: profile.tenant_id,
      form_id: formId,
      question_text: values.question_text,
      question_type: values.question_type,
      options: values.options && values.options.length > 0 ? values.options : null,
      is_required: values.is_required,
      sort_order: values.sort_order,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/forms");
  return data;
}

export async function updateFormQuestion(id: string, values: Partial<FormQuestionValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("form_questions")
    .update({
      question_text: values.question_text,
      question_type: values.question_type,
      options: values.options && values.options.length > 0 ? values.options : null,
      is_required: values.is_required,
      sort_order: values.sort_order,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/forms");
}

export async function deleteFormQuestion(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("form_questions")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/forms");
}

export async function reorderFormQuestions(
  questions: Array<{ id: string; sort_order: number }>
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  await Promise.all(
    questions.map(({ id, sort_order }) =>
      supabase
        .from("form_questions")
        .update({ sort_order })
        .eq("id", id)
        .eq("tenant_id", profile.tenant_id)
    )
  );

  revalidatePath("/forms");
}

export async function bulkCreateFormQuestions(
  formId: string,
  questions: ParsedQuestion[]
) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (!form) throw new Error("Form not found");

  // Get current max sort_order to append after existing questions
  const { data: existing } = await supabase
    .from("form_questions")
    .select("sort_order")
    .eq("form_id", formId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const startOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const rows = questions.map((q, i) => ({
    tenant_id: profile.tenant_id,
    form_id: formId,
    question_text: q.label,
    question_type: q.type,
    options: q.options && q.options.length > 0 ? q.options : null,
    is_required: q.is_required,
    sort_order: startOrder + i,
  }));

  const { error } = await supabase.from("form_questions").insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath("/forms");
}
