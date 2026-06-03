import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { DATA_KEY_OPTIONS, type DataKeyOption } from "../domain/data-keys";

export type BookingQuestionOption = {
  id: string;
  question_text: string;
  question_type: string;
  form_id: string;
  form_name: string;
  portfolio_id: string | null;
};

/**
 * List the tenant's booking-form questions, optionally filtered to the
 * template's portfolio. The picker uses this when binding a field to
 * `booking_response`. Non-text question types are returned too so the
 * UI can show + disable them (file_upload / info can't be stamped).
 */
export async function listBookingFormQuestionsForTemplate(
  templateId: string,
): Promise<BookingQuestionOption[]> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data: template } = await supabase
    .from("contract_templates")
    .select("portfolio_id")
    .eq("id", templateId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  const portfolioId = template?.portfolio_id ?? null;

  let formsQuery = supabase
    .from("booking_forms")
    .select("id, name, portfolio_id")
    .eq("tenant_id", profile.tenant_id);
  if (portfolioId) {
    formsQuery = formsQuery.or(`portfolio_id.is.null,portfolio_id.eq.${portfolioId}`);
  }
  const { data: forms, error: formsError } = await formsQuery;
  if (formsError) throw new Error(formsError.message);
  if (!forms || forms.length === 0) return [];

  const formIds = forms.map((f) => f.id);
  const formMap = new Map(forms.map((f) => [f.id, f]));

  const { data: questions, error: qError } = await supabase
    .from("form_questions")
    .select("id, question_text, question_type, form_id, sort_order")
    .in("form_id", formIds)
    .eq("tenant_id", profile.tenant_id)
    .order("sort_order", { ascending: true });
  if (qError) throw new Error(qError.message);

  return (questions ?? []).map((q) => {
    const form = formMap.get(q.form_id);
    return {
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      form_id: q.form_id,
      form_name: form?.name ?? "",
      portfolio_id: form?.portfolio_id ?? null,
    };
  });
}

export function listDataKeyOptions(): DataKeyOption[] {
  return DATA_KEY_OPTIONS;
}
