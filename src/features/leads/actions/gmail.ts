"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { syncTenantGmail, type SyncResult } from "@/lib/gmail/syncTenant";

export type { SyncResult };

export async function disconnectGmail() {
  const supabase = createSupabaseServerClient();
  const profile = await requireRole([...ADMIN_ROLES]);

  const { error } = await supabase
    .from("tenant_gmail_connections")
    .delete()
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath("/leads/settings");
}

export async function syncGmail(): Promise<SyncResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const result = await syncTenantGmail(profile.tenant_id);

  revalidatePath("/leads");
  revalidatePath("/leads/settings");

  return result;
}
