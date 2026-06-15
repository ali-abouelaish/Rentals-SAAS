"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface AnswerInput {
  question_id: string;
  answer_text?: string;
}

export async function submitForm(
  slug: string,
  respondent: {
    respondent_name?: string;
    respondent_email?: string;
    respondent_phone?: string;
  },
  answers: AnswerInput[]
): Promise<{ submissionId: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, tenant_id")
    .eq("public_slug", slug)
    .eq("is_active", true)
    .single();

  if (formError || !form) throw new Error("Form not found or inactive");

  const { data: requiredQuestions } = await supabase
    .from("form_questions")
    .select("id")
    .eq("form_id", form.id)
    .eq("is_required", true);

  for (const q of requiredQuestions ?? []) {
    const ans = answers.find((a) => a.question_id === q.id);
    if (!ans || !ans.answer_text?.trim()) {
      throw new Error("Please answer all required questions");
    }
  }

  const { data: submission, error: subError } = await supabase
    .from("form_submissions")
    .insert({
      tenant_id: form.tenant_id,
      form_id: form.id,
      respondent_name: respondent.respondent_name || null,
      respondent_email: respondent.respondent_email || null,
      respondent_phone: respondent.respondent_phone || null,
    })
    .select("id")
    .single();

  if (subError || !submission) throw new Error(subError?.message ?? "Failed to submit form");

  const answerRows = answers
    .filter((a) => a.answer_text?.trim())
    .map((a) => ({
      tenant_id: form.tenant_id,
      submission_id: submission.id,
      question_id: a.question_id,
      answer_text: a.answer_text || null,
    }));

  if (answerRows.length > 0) {
    const { error: ansErr } = await supabase.from("form_answers").insert(answerRows);
    if (ansErr) throw new Error(ansErr.message);
  }

  return { submissionId: submission.id };
}
