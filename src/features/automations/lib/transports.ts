// Channel transports for the scheduled-messages worker. The queue never knows
// about email providers — the email channel hands off to sendEmail, which
// resolves the agency's transport (Graph/Gmail/SMTP with Resend fallback) and
// writes email_log/error_events itself.

import { sendEmail } from "@/lib/email/send";
import type { ScheduledMessageRow } from "../domain/types";
import { bodyToHtml } from "./render";

/** Failure that retrying can never fix — the worker dead-letters immediately. */
export class PermanentSendError extends Error {}

export type DeliverOutcome = { sentTo: string | null; providerId: string | null };

export async function deliverMessage(
  row: ScheduledMessageRow,
  address: string | null,
  pmTenantId?: string
): Promise<DeliverOutcome> {
  switch (row.channel) {
    case "email": {
      if (!address) {
        throw new PermanentSendError("No email address resolved for recipient");
      }
      const { providerId } = await sendEmail(row.tenant_id, {
        to: address,
        subject: row.subject || "(no subject)",
        html: bodyToHtml(row.body),
        text: row.body,
        pmTenantId,
        templateKey: row.rule_id ? `automation:${row.rule_id}` : "adhoc_reminder",
      });
      return { sentTo: address, providerId };
    }

    case "sms":
      // Schema-ready stub: the channel exists end-to-end but no SMS provider
      // is wired up yet. Swap this for a real transport when one is chosen.
      throw new PermanentSendError("SMS transport not configured");

    case "in_app":
      // Delivery = the row becoming visible in the reminders inbox ("sent" and
      // unacknowledged). Nothing leaves the system.
      return { sentTo: null, providerId: null };
  }
}
