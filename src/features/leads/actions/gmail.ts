"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getGmailClientForTenant, fetchInboxMessageIds, fetchMessage, getMailboxHistoryId } from "@/lib/gmail/apiClient";
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

  // Build a Gmail search query scoped to the tenant's active platform sender
  // domains so we only scan relevant mail. Unlike the push/history path, this
  // pulls existing messages, so "Sync now" works without any Pub/Sub delivery.
  // processEmail still dedupes by message_id, so re-syncing is safe.
  const { data: configs } = await admin
    .from("tenant_platform_configs")
    .select("sender_domain")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const domains = (configs ?? [])
    .map((c) => c.sender_domain)
    .filter((d): d is string => Boolean(d));
  const query = [
    domains.length ? `from:(${domains.join(" OR ")})` : "",
    "newer_than:30d",
  ]
    .filter(Boolean)
    .join(" ");

  const messageIds = await fetchInboxMessageIds(gmailClient, { query, max: 200 });

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

  // Refresh the stored history_id so the push webhook has a valid cursor going
  // forward, then stamp the sync time.
  let historyId = conn.history_id;
  try {
    historyId = (await getMailboxHistoryId(gmailClient)) || conn.history_id;
  } catch {
    // keep existing cursor on failure
  }

  await admin
    .from("tenant_gmail_connections")
    .update({
      history_id: historyId,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  revalidatePath("/leads");
  revalidatePath("/leads/settings");

  return { processed: messageIds.length, created, skipped };
}
