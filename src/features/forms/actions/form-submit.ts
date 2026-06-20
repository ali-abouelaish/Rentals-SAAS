"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES_PER_QUESTION = 3;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function submitForm(formData: FormData): Promise<{ submissionId: string }> {
  const slug = String(formData.get("slug") ?? "");
  const supabase = createSupabaseAdminClient();

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, tenant_id")
    .eq("public_slug", slug)
    .eq("is_active", true)
    .single();

  if (formError || !form) throw new Error("Form not found or inactive");

  const { data: questions } = await supabase
    .from("form_questions")
    .select("id, question_type, is_required")
    .eq("form_id", form.id);

  for (const q of questions ?? []) {
    if (q.question_type === "info" || !q.is_required) continue;
    if (q.question_type === "file") {
      const files = formData.getAll(`file_${q.id}`) as File[];
      const valid = files.filter((f) => f.size > 0);
      if (valid.length === 0) throw new Error("Please upload all required files");
    } else {
      const text = String(formData.get(`answer_${q.id}`) ?? "").trim();
      if (!text) throw new Error("Please answer all required questions");
    }
  }

  const { data: submission, error: subError } = await supabase
    .from("form_submissions")
    .insert({
      tenant_id: form.tenant_id,
      form_id: form.id,
      respondent_name: String(formData.get("respondent_name") ?? "") || null,
      respondent_email: String(formData.get("respondent_email") ?? "") || null,
      respondent_phone: String(formData.get("respondent_phone") ?? "") || null,
    })
    .select("id")
    .single();

  if (subError || !submission) throw new Error(subError?.message ?? "Failed to submit form");

  const answerRows: Array<{
    tenant_id: string;
    submission_id: string;
    question_id: string;
    answer_text: string | null;
  }> = [];

  for (const q of questions ?? []) {
    if (q.question_type === "info") continue;

    if (q.question_type === "file") {
      const files = (formData.getAll(`file_${q.id}`) as File[]).filter((f) => f.size > 0);
      if (files.length === 0) continue;

      const paths: string[] = [];
      for (let i = 0; i < Math.min(files.length, MAX_FILES_PER_QUESTION); i++) {
        const file = files[i];
        if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" exceeds the 10 MB limit`);
        if (!ALLOWED_MIME.has(file.type)) throw new Error(`File type not allowed: ${file.name}`);

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `${form.tenant_id}/${form.id}/${submission.id}/${q.id}_${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("form-uploads")
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        paths.push(path);
      }

      answerRows.push({
        tenant_id: form.tenant_id,
        submission_id: submission.id,
        question_id: q.id,
        answer_text: JSON.stringify(paths),
      });
    } else {
      const text = String(formData.get(`answer_${q.id}`) ?? "").trim();
      if (!text) continue;
      answerRows.push({
        tenant_id: form.tenant_id,
        submission_id: submission.id,
        question_id: q.id,
        answer_text: text,
      });
    }
  }

  if (answerRows.length > 0) {
    const { error: ansErr } = await supabase.from("form_answers").insert(answerRows);
    if (ansErr) throw new Error(ansErr.message);
  }

  return { submissionId: submission.id };
}
