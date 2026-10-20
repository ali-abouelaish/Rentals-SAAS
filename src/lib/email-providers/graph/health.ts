import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptProviderCredentials } from "../encrypt";
import { getValidGraphAccessToken, GraphAuthError } from "./tokens";
import { failEmailProvider } from "../alert";
import { fetchMailboxAddress } from "./oauth";
import { tenantsWithFeatureDisabled } from "@/lib/entitlements/tenantFeature";
import type { OAuthCredentials } from "@/lib/email/transport/types";

export type GraphHealthSummary = { checked: number; ok: number; failed: number };

/**
 * Proactively verify every active Graph connection so a dead mailbox surfaces
 * (and the agency is alerted) BEFORE the daily rent-reminder run tries to use
 * it. For each active provider we refresh the token if needed and make a cheap
 * Graph /me call; a failure flips the provider to error and alerts once.
 */
export async function runGraphHealthCheck(): Promise<GraphHealthSummary> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("email_providers")
    .select("tenant_id, credentials")
    .eq("type", "graph")
    .eq("status", "active");

  if (error) throw new Error(error.message);
  // With Email Sending switched off the mailbox isn't used, and a failure alert
  // would send the agency to a settings page they can no longer open.
  const disabled = await tenantsWithFeatureDisabled("email_sending");
  const rows = (data ?? []).filter((row) => !disabled.has(row.tenant_id as string));
  const summary: GraphHealthSummary = { checked: rows.length, ok: 0, failed: 0 };

  for (const row of rows) {
    const tenantId = row.tenant_id as string;
    try {
      if (!row.credentials) throw new Error("Provider has no stored credentials");
      const creds = JSON.parse(decryptProviderCredentials(row.credentials as string)) as OAuthCredentials;
      const token = await getValidGraphAccessToken(tenantId, creds);
      await fetchMailboxAddress(token); // liveness probe
      await admin
        .from("email_providers")
        .update({ verified_at: new Date().toISOString(), last_error: null })
        .eq("tenant_id", tenantId);
      summary.ok += 1;
    } catch (err) {
      // getValidGraphAccessToken already alerts on a GraphAuthError; only alert
      // here for other liveness failures (e.g. the /me probe itself failing).
      if (!(err instanceof GraphAuthError)) {
        const message = err instanceof Error ? err.message : String(err);
        await failEmailProvider(tenantId, `Health check failed: ${message}`);
      }
      summary.failed += 1;
    }
  }

  return summary;
}
