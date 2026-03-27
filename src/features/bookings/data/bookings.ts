import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Booking, BookingFilters } from "../domain/types";

const SELECT = `*,
  unit:units(
    room_number, unit_type,
    property:properties(name, address_line_1, portfolio:portfolios(id, name, color))
  ),
  form_responses(*, question:form_questions(question_text, question_type))`;

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
  return data as Booking;
}
