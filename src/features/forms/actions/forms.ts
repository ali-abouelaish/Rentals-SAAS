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

  const { error } = await supabase
    .from("forms")
    .update({
      name: values.name,
      description: values.description ?? null,
      is_active: values.is_active,
    })
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
