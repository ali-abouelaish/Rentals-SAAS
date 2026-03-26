"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { quickLinkSchema } from "../domain/schemas";

export async function addQuickLink(
  _prev: { error?: string },
  formData: FormData
) {
  const profile = await requireRole(["admin", "super_admin"]);

  const parsed = quickLinkSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    url: String(formData.get("url") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }

  const supabase = createSupabaseServerClient();

  // Place new link after the current last one
  const { data: existing } = await supabase
    .from("tenant_quick_links")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? -1) + 1;

  const { error } = await supabase.from("tenant_quick_links").insert({
    tenant_id: profile.tenant_id,
    position,
    ...parsed.data,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}

export async function updateQuickLink(
  _prev: { error?: string },
  formData: FormData
) {
  await requireRole(["admin", "super_admin"]);

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing link ID" };

  const parsed = quickLinkSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    url: String(formData.get("url") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid data" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_quick_links")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}

export async function deleteQuickLink(formData: FormData) {
  await requireRole(["admin", "super_admin"]);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createSupabaseServerClient();
  await supabase.from("tenant_quick_links").delete().eq("id", id);

  revalidatePath("/dashboard");
}
