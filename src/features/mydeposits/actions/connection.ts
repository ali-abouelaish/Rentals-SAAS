"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function disconnectMydeposits(): Promise<{ ok: true }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("mydeposits_connections")
    .delete()
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/deposits");
  revalidatePath("/deposits");
  return { ok: true };
}
