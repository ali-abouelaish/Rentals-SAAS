"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { generateApiKey } from "@/lib/api-keys/hash";

export async function createPublicApiKey(formData: FormData): Promise<{ plaintext: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Label is required.");

  const { plaintext, hash, prefix } = generateApiKey();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("public_api_keys").insert({
    tenant_id: profile.tenant_id,
    label,
    key_hash: hash,
    key_prefix: prefix,
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/settings/api-keys");
  return { plaintext };
}

export async function revokePublicApiKey(formData: FormData): Promise<void> {
  await requireRole([...ADMIN_ROLES]);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing key id.");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("public_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/api-keys");
}

export async function deletePublicApiKey(formData: FormData): Promise<void> {
  await requireRole([...ADMIN_ROLES]);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing key id.");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("public_api_keys").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/api-keys");
}
