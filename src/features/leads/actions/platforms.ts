"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { platformConfigSchema, type PlatformConfigValues } from "../domain/schemas";

export async function createPlatformConfig(values: PlatformConfigValues) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);
  const payload = platformConfigSchema.parse(values);

  const { error } = await supabase.from("tenant_platform_configs").insert({
    ...payload,
    tenant_id: profile.tenant_id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/leads/settings");
}

export async function updatePlatformConfig(id: string, values: Partial<PlatformConfigValues>) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);

  const { error } = await supabase
    .from("tenant_platform_configs")
    .update(values)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/leads/settings");
}

export async function deletePlatformConfig(id: string) {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);

  const { error } = await supabase
    .from("tenant_platform_configs")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/leads/settings");
}
