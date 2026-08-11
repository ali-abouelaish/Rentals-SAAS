// Gmail lead-sync job. Runs every 15 minutes via the in-process scheduler and
// is also reachable at /api/cron/gmail-sync (CRON_SECRET-guarded) for manual
// triggering. Pulls recent portal mail into leads for every connected tenant,
// independent of Gmail push delivery (which can't reach non-public hosts).

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncTenantGmail } from "@/lib/gmail/syncTenant";

export type GmailSyncSummary = {
  ok: true;
  tenants: number;
  created: number;
  processed: number;
  failed: number;
  durationMs: number;
};

export async function runGmailSync(): Promise<GmailSyncSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();

  const { data: connections } = await admin
    .from("tenant_gmail_connections")
    .select("tenant_id");

  const tenantIds = (connections ?? [])
    .map((c) => c.tenant_id)
    .filter((id): id is string => Boolean(id));

  let created = 0;
  let processed = 0;
  let failed = 0;

  // Sequential to keep Gmail API usage gentle and avoid concurrent refresh-token
  // rotation on a single mailbox.
  for (const tenantId of tenantIds) {
    try {
      const result = await syncTenantGmail(tenantId);
      created += result.created;
      processed += result.processed;
    } catch (err) {
      failed++;
      console.error(
        `[cron] gmail-sync failed for tenant ${tenantId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    ok: true,
    tenants: tenantIds.length,
    created,
    processed,
    failed,
    durationMs: Date.now() - startedAt,
  };
}
