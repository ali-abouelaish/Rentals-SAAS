import { runGraphHealthCheck, type GraphHealthSummary } from "@/lib/email-providers/graph/health";
import { runGmailHealthCheck, type GmailHealthSummary } from "@/lib/email-providers/gmail/health";

export type EmailProviderHealthSummary = {
  graph: GraphHealthSummary;
  gmail: GmailHealthSummary;
};

/**
 * Validate every active custom email provider so a dead connection is detected
 * (and the agency alerted) before the daily rent-reminder run depends on it.
 * Runs shortly before the 09:00 reminder job.
 */
export async function runEmailProviderHealth(): Promise<EmailProviderHealthSummary> {
  const [graph, gmail] = await Promise.all([runGraphHealthCheck(), runGmailHealthCheck()]);
  return { graph, gmail };
}
