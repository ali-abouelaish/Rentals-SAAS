import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getGmailClientForTenant,
  fetchInboxMessageIds,
  fetchMessage,
  getMailboxHistoryId,
} from "./apiClient";
import { processEmail } from "./processEmail";

export type SyncResult = {
  processed: number;
  created: number;
  skipped: number;
};

/**
 * Pull recent portal mail for one tenant and turn it into leads. Scans the
 * mailbox (via `users.messages.list`) for the tenant's active platform sender
 * domains rather than relying on Gmail push — so it works without Pub/Sub and
 * as a manual "Sync now". processEmail dedupes by message_id, so re-running is
 * safe. Refreshes the stored history_id so the push webhook keeps a valid
 * cursor going forward.
 *
 * Tenant-agnostic: takes an explicit tenantId with no auth check, so it can be
 * driven by the cron scheduler. Callers exposed to users must gate access
 * (e.g. requireRole) before calling.
 */
export async function syncTenantGmail(tenantId: string): Promise<SyncResult> {
  const admin = createSupabaseAdminClient();

  const { data: conn } = await admin
    .from("tenant_gmail_connections")
    .select("history_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!conn) throw new Error("Gmail is not connected.");

  const gmailClient = await getGmailClientForTenant(tenantId);

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
    if (!message) {
      skipped++;
      continue;
    }
    const result = await processEmail(message, tenantId);
    if (result.action === "created") created++;
    else skipped++;
  }

  // Refresh the stored history_id so the push webhook has a valid cursor.
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

  return { processed: messageIds.length, created, skipped };
}
