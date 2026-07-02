import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { BookingForm, FormQuestion } from "../domain/types";

export async function getBookingForms(): Promise<BookingForm[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("booking_forms")
    .select("*, portfolio:portfolios(name, color), questions:booking_form_questions(*)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as BookingForm[]).map((f) => ({
    ...f,
    questions: ((f.questions ?? []) as FormQuestion[])
      .map((q) => ({
        ...q,
        options: q.options
          ? typeof q.options === "string"
            ? JSON.parse(q.options)
            : q.options
          : null,
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getBookingFormWithQuestions(id: string): Promise<BookingForm | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("booking_forms")
    .select("*, portfolio:portfolios(name, color), questions:booking_form_questions(*)")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .order("sort_order", { referencedTable: "booking_form_questions", ascending: true })
    .single();

  if (error) return null;
  if (!data) return null;

  return {
    ...data,
    questions: ((data.questions as FormQuestion[]) ?? []).map((q) => ({
      ...q,
      options: q.options ? (typeof q.options === "string" ? JSON.parse(q.options) : q.options) : null,
    })),
  } as BookingForm;
}

// Public — no auth (used on /apply/[slug])
export async function getPublicBookingForm(slug: string): Promise<BookingForm | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("booking_forms")
    .select("*, questions:booking_form_questions(*), tenant:tenants(name, branding:tenant_branding_settings(brand_name, logo_url))")
    .eq("public_slug", slug)
    .eq("is_active", true)
    .order("sort_order", { referencedTable: "booking_form_questions", ascending: true })
    .single();

  if (error || !data) return null;

  return {
    ...data,
    questions: ((data.questions as FormQuestion[]) ?? []).map((q) => ({
      ...q,
      options: q.options ? (typeof q.options === "string" ? JSON.parse(q.options) : q.options) : null,
    })),
  } as BookingForm;
}
