import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptProviderCredentials } from "../encrypt";
import { failEmailProvider } from "../alert";
import { getValidGmailAccessToken, GmailAuthError } from "./tokens";
import { fetchEmailAddress } from "./oauth";
import type { OAuthCredentials } from "@/lib/email/transport/types";

export type GmailHealthSummary = { checked: number; ok: number; failed: number };

/** Verify every active Gmail connection before the daily rent-reminder run. */
export async function runGmailHealthCheck(): Promise<GmailHealthSummary> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("email_providers")
    .select("tenant_id, credentials")
    .eq("type", "gmail")
    .eq("status", "active");

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const summary: GmailHealthSummary = { checked: rows.length, ok: 0, failed: 0 };

  for (const row of rows) {
    const tenantId = row.tenant_id as string;
    try {
      if (!row.credentials) throw new Error("Provider has no stored credentials");
      const creds = JSON.parse(decryptProviderCredentials(row.credentials as string)) as OAuthCredentials;
      const token = await getValidGmailAccessToken(tenantId, creds);
      await fetchEmailAddress(token); // liveness probe
      await admin
        .from("email_providers")
        .update({ verified_at: new Date().toISOString(), last_error: null })
        .eq("tenant_id", tenantId);
      summary.ok += 1;
    } catch (err) {
      if (!(err instanceof GmailAuthError)) {
        const message = err instanceof Error ? err.message : String(err);
        await failEmailProvider(tenantId, `Health check failed: ${message}`);
      }
      summary.failed += 1;
    }
  }

  return summary;
}
