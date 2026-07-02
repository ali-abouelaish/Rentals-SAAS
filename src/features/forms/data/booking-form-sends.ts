import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export type BookingFormSendAnswer = {
  question_id: string;
  answer_text: string | null;
  question_text?: string;
};

export type BookingFormSend = {
  id: string;
  form_id: string;
  recipient_email: string;
  status: "sent" | "completed";
  sent_at: string;
  completed_at: string | null;
  submission_id: string | null;
  form: { name: string } | null;
  submission: { id: string; answers: BookingFormSendAnswer[] } | null;
};

// All generic-form sends recorded against a booking, with each completed
// submission's answers enriched with their question text.
export async function getBookingFormSends(bookingId: string): Promise<BookingFormSend[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("booking_form_sends")
    .select(
      `id, form_id, recipient_email, status, sent_at, completed_at, submission_id,
       form:forms(name),
       submission:form_submissions(id, answers:form_answers(question_id, answer_text))`
    )
    .eq("booking_id", bookingId)
    .eq("tenant_id", profile.tenant_id)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(error.message);

  const sends = (data ?? []) as unknown as BookingFormSend[];

  // Enrich answers with their question text (generic forms use form_questions).
  const questionIds = [
    ...new Set(sends.flatMap((s) => s.submission?.answers?.map((a) => a.question_id) ?? [])),
  ];
  if (questionIds.length > 0) {
    const { data: questions } = await supabase
      .from("form_questions")
      .select("id, question_text")
      .in("id", questionIds);
    const qMap = Object.fromEntries((questions ?? []).map((q) => [q.id, q.question_text as string]));
    for (const s of sends) {
      if (s.submission?.answers) {
        s.submission.answers = s.submission.answers.map((a) => ({
          ...a,
          question_text: qMap[a.question_id],
        }));
      }
    }
  }

  return sends;
}
