"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getGmailClientForTenant, fetchMessagesByHistoryId, fetchMessage } from "@/lib/gmail/apiClient";
import { processEmail } from "@/lib/gmail/processEmail";

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

export type SyncResult = {
  processed: number;
  created: number;
  skipped: number;
};

export async function syncGmail(): Promise<SyncResult> {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const profile = await requireRole([...ADMIN_ROLES]);
  const tenantId = profile.tenant_id;

  const { data: conn } = await supabase
    .from("tenant_gmail_connections")
    .select("history_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!conn) throw new Error("Gmail is not connected.");

  const gmailClient = await getGmailClientForTenant(tenantId);
  const historyId = conn.history_id ?? "1";

  const messageIds = await fetchMessagesByHistoryId(gmailClient, historyId);

  let created = 0;
  let skipped = 0;

  for (const msgId of messageIds) {
    const message = await fetchMessage(gmailClient, msgId);
    if (!message) { skipped++; continue; }

    const result = await processEmail(message, tenantId);
    if (result.action === "created") {
      created++;
    } else {
      skipped++;
    }
  }

  // Update last_synced_at
  await admin
    .from("tenant_gmail_connections")
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  revalidatePath("/leads");
  revalidatePath("/leads/settings");

  return { processed: messageIds.length, created, skipped };
}
