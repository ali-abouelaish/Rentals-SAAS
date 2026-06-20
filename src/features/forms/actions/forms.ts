"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { FormValues } from "../domain/schemas";

function generateSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function createForm(values: FormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("forms")
    .insert({
      tenant_id: profile.tenant_id,
      name: values.name,
      description: values.description || null,
      is_active: values.is_active ?? true,
      public_slug: generateSlug(),
      portfolio_id: values.portfolio_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/forms");
  return data;
}

export async function updateForm(id: string, values: Partial<FormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const patch: Record<string, unknown> = {};
  if (values.name !== undefined) patch.name = values.name;
  if (values.description !== undefined) patch.description = values.description ?? null;
  if (values.is_active !== undefined) patch.is_active = values.is_active;
  if ("portfolio_id" in values) patch.portfolio_id = values.portfolio_id ?? null;

  const { error } = await supabase
    .from("forms")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/forms");
}

export async function deleteForm(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("forms")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/forms");
}

export async function duplicateForm(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: original, error: fetchError } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (fetchError || !original) throw new Error("Form not found");

  const { data: newForm, error: insertError } = await supabase
    .from("forms")
    .insert({
      tenant_id: profile.tenant_id,
      name: `${original.name} (copy)`,
      description: original.description,
      is_active: false,
      public_slug: generateSlug(),
      portfolio_id: original.portfolio_id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !newForm) throw new Error(insertError?.message ?? "Failed to duplicate form");

  const { data: questions, error: qError } = await supabase
    .from("form_questions")
    .select("*")
    .eq("form_id", id)
    .order("sort_order", { ascending: true });

  if (!qError && questions && questions.length > 0) {
    const newQuestions = questions.map((q: Record<string, unknown>) => ({
      tenant_id: profile.tenant_id,
      form_id: newForm.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? null,
      is_required: q.is_required,
      sort_order: q.sort_order,
    }));

    await supabase.from("form_questions").insert(newQuestions);
  }

  revalidatePath("/forms");
  return newForm;
}
