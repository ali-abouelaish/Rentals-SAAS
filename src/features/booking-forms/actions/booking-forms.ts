"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getBookingFormWithQuestions } from "../data/booking-forms";
import type { BookingForm } from "../domain/types";
import type { BookingFormValues } from "../domain/schemas";

function generateSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function createBookingForm(values: BookingFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("booking_forms")
    .insert({
      tenant_id: profile.tenant_id,
      name: values.name,
      description: values.description || null,
      portfolio_id: values.portfolio_id || null,
      is_active: values.is_active ?? true,
      public_slug: generateSlug(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/settings/booking-forms");
  return data;
}

export async function updateBookingForm(id: string, values: Partial<BookingFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("booking_forms")
    .update({
      name: values.name,
      description: values.description || null,
      portfolio_id: values.portfolio_id || null,
      is_active: values.is_active,
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/booking-forms");
}

export async function duplicateBookingForm(id: string): Promise<BookingForm | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  // Load the source form (tenant-scoped).
  const { data: source, error: srcErr } = await supabase
    .from("booking_forms")
    .select("name, description, portfolio_id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (srcErr || !source) throw new Error(srcErr?.message ?? "Form not found");

  // Insert the copy: inactive draft, fresh slug, no bank-details override
  // (falls back to the portfolio default, which stays correct if the portfolio
  // is later changed).
  const { data: copy, error: copyErr } = await supabase
    .from("booking_forms")
    .insert({
      tenant_id: profile.tenant_id,
      name: `${source.name} (copy)`,
      description: source.description,
      portfolio_id: source.portfolio_id,
      is_active: false,
      public_slug: generateSlug(),
    })
    .select("id")
    .single();

  if (copyErr || !copy) throw new Error(copyErr?.message ?? "Failed to duplicate form");

  // Copy every question verbatim onto the new form (fresh ids via DB default).
  const { data: questions, error: qErr } = await supabase
    .from("booking_form_questions")
    .select("question_text, question_type, options, is_required, sort_order")
    .eq("form_id", id)
    .eq("tenant_id", profile.tenant_id);

  if (qErr) throw new Error(qErr.message);

  if (questions && questions.length > 0) {
    const { error: qInsertErr } = await supabase.from("booking_form_questions").insert(
      questions.map((q) => ({
        tenant_id: profile.tenant_id,
        form_id: copy.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        is_required: q.is_required,
        sort_order: q.sort_order,
      }))
    );
    if (qInsertErr) throw new Error(qInsertErr.message);
  }

  revalidatePath("/settings/booking-forms");

  // Return the fully-formed new form (with the freshly-created question ids) so
  // the client can render it without reusing the source's question ids.
  return getBookingFormWithQuestions(copy.id);
}

export async function deleteBookingForm(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("booking_forms")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/booking-forms");
}
