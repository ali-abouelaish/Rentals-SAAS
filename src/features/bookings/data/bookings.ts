import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Booking, BookingFilters } from "../domain/types";

const SELECT = `*,
  unit:units(
    room_number, unit_type,
    property:properties(name, address_line_1, portfolio:portfolios(id, name, color))
  ),
  form_responses(*)`;

export async function getBookings(filters: Partial<BookingFilters> = {}): Promise<Booking[]> {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("bookings")
    .select(SELECT)
    .order("submitted_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte("submitted_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("submitted_at", filters.dateTo + "T23:59:59");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let result = (data ?? []) as Booking[];

  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (b) =>
        b.applicant_name.toLowerCase().includes(s) ||
        b.applicant_email.toLowerCase().includes(s) ||
        b.unit?.property.name.toLowerCase().includes(s) ||
        b.unit?.property.address_line_1.toLowerCase().includes(s)
    );
  }

  if (filters.portfolioId) {
    result = result.filter(
      (b) => b.unit?.property.portfolio && (b.unit.property.portfolio as { id: string }).id === filters.portfolioId
    );
  }

  // Enrich form_responses with question text in one batched query so the
  // drawer (responses tab + contract dialog) can show question labels.
  const questionIds = [
    ...new Set(result.flatMap((b) => (b.form_responses ?? []).map((r) => r.question_id))),
  ];
  if (questionIds.length > 0) {
    const { data: questions } = await supabase
      .from("booking_form_questions")
      .select("id, question_text, question_type")
      .in("id", questionIds);
    const qMap = Object.fromEntries((questions ?? []).map((q) => [q.id, q]));
    for (const b of result) {
      if (b.form_responses?.length) {
        b.form_responses = b.form_responses.map((r) => ({ ...r, question: qMap[r.question_id] ?? undefined }));
      }
    }
  }

  return result;
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT)
    .eq("id", id)
    .single();
  if (error) return null;

  const booking = data as Booking;

  // Enrich form_responses with question data via a separate query to avoid
  // PostgREST needing to resolve the form_responses→booking_form_questions FK in cache.
  const responses = booking.form_responses ?? [];
  if (responses.length > 0) {
    const questionIds = [...new Set(responses.map((r) => r.question_id))];
    const { data: questions } = await supabase
      .from("booking_form_questions")
      .select("id, question_text, question_type")
      .in("id", questionIds);
    const qMap = Object.fromEntries((questions ?? []).map((q) => [q.id, q]));
    booking.form_responses = responses.map((r) => ({ ...r, question: qMap[r.question_id] ?? null }));
  }

  return booking;
}
