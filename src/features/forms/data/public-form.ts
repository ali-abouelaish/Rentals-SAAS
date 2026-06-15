import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Form, FormQuestion } from "../domain/types";

// Public — no auth (used on /f/[slug])
export async function getPublicForm(slug: string): Promise<Form | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("forms")
    .select("*, questions:form_questions(*), tenant:tenants(name, branding:tenant_branding_settings(brand_name, logo_url))")
    .eq("public_slug", slug)
    .eq("is_active", true)
    .order("sort_order", { referencedTable: "form_questions", ascending: true })
    .single();

  if (error || !data) return null;

  return {
    ...data,
    questions: ((data.questions as FormQuestion[]) ?? []).map((q) => ({
      ...q,
      options: q.options
        ? typeof q.options === "string"
          ? JSON.parse(q.options)
          : q.options
        : null,
    })),
  } as Form;
}
