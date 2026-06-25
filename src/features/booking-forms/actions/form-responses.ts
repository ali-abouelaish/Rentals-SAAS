"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface FormAnswerInput {
  question_id: string;
  answer_text?: string;
  answer_file_url?: string;
}

export async function submitBookingForm(
  slug: string,
  applicantData: {
    unit_id?: string;
    applicant_name: string;
    applicant_email: string;
    applicant_phone: string;
  },
  answers: FormAnswerInput[]
): Promise<{ bookingId: string }> {
  // Use admin client — no user session on public /apply pages
  const supabase = createSupabaseAdminClient();

  // Fetch the active form by slug
  const { data: form, error: formError } = await supabase
    .from("booking_forms")
    .select("id, tenant_id, portfolio_id")
    .eq("public_slug", slug)
    .eq("is_active", true)
    .single();

  if (formError || !form) throw new Error("Form not found or inactive");

  // Fetch required questions to validate
  const { data: requiredQuestions } = await supabase
    .from("booking_form_questions")
    .select("id")
    .eq("form_id", form.id)
    .eq("is_required", true);

  const answeredIds = new Set(answers.map((a) => a.question_id));
  for (const q of requiredQuestions ?? []) {
    const ans = answers.find((a) => a.question_id === q.id);
    if (!ans || (!ans.answer_text?.trim() && !ans.answer_file_url?.trim())) {
      throw new Error("Please answer all required questions");
    }
  }

  // Fetch unit to get property_id if unit_id is provided
  let propertyId: string | null = null;
  if (applicantData.unit_id) {
    const { data: unit } = await supabase
      .from("units")
      .select("property_id")
      .eq("id", applicantData.unit_id)
      .single();
    propertyId = unit?.property_id ?? null;
  }

  // Insert booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      tenant_id: form.tenant_id,
      form_id: form.id,
      unit_id: applicantData.unit_id ?? null,
      property_id: propertyId,
      portfolio_id: form.portfolio_id,
      applicant_name: applicantData.applicant_name,
      applicant_email: applicantData.applicant_email,
      applicant_phone: applicantData.applicant_phone,
      status: "pending",
    })
    .select("id")
    .single();

  if (bookingError || !booking) throw new Error(bookingError?.message ?? "Failed to submit application");

  // Insert form responses
  if (answers.length > 0) {
    const responseRows = answers
      .filter((a) => a.answer_text?.trim() || a.answer_file_url?.trim())
      .map((a) => ({
        tenant_id: form.tenant_id,
        booking_id: booking.id,
        question_id: a.question_id,
        answer_text: a.answer_text || null,
        answer_file_url: a.answer_file_url || null,
      }));

    if (responseRows.length > 0) {
      const { error: responsesError } = await supabase
        .from("form_responses")
        .insert(responseRows);
      if (responsesError) throw new Error(responsesError.message);
    }
  }

  return { bookingId: booking.id };
}
