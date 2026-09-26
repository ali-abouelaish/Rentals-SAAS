import "server-only";

import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { getTenantAppUrl, tenantAppUrl } from "@/lib/email/app-url";
import {
  generateSupportTicketAgencyReplyEmail,
  generateSupportTicketPlatformReplyEmail,
  generateSupportTicketRaisedEmail,
  generateSupportTicketStatusEmail,
} from "@/lib/email/templates/support";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, type TicketCategory, type TicketPriority, type TicketStatus } from "../domain/types";

// Support mail always goes through sendAgencyEmail (central Resend), NEVER the
// outbox: the outbox drain delivers via sendEmail, which uses the agency's own
// connected mailbox and, on failure, fires a "your email provider failed" alert
// at the agency — triggered by OUR mail. No retry is the accepted trade-off;
// failures are still recorded in email_log.
//
// Every function here warns rather than throws on missing data, and callers
// wrap them in try/catch: a notification must never lose a ticket or reply.

function platformInbox(): string | null {
  const v = process.env.PLATFORM_SUPPORT_EMAIL?.trim();
  return v ? v : null;
}

/** Super admins are not tied to an agency subdomain — use the flat app URL. */
function adminTicketUrl(ticketId: string): string {
  return tenantAppUrl(null, `/admin/support/${ticketId}`);
}

type TicketBundle = {
  id: string;
  tenant_id: string;
  reference: string;
  subject: string;
  body: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  created_by_name: string;
  created_by_email: string;
  page_url: string | null;
};

export async function notifyPlatformOfNewTicket(ticket: TicketBundle, attachmentCount: number): Promise<void> {
  const to = platformInbox();
  if (!to) {
    console.warn("[helpdesk.email] PLATFORM_SUPPORT_EMAIL is not set; skipping new-ticket email", ticket.reference);
    return;
  }
  const agency = await loadAgency(ticket.tenant_id);
  if (!agency) {
    console.warn("[helpdesk.email] agency not found", ticket.tenant_id);
    return;
  }
  const email = generateSupportTicketRaisedEmail({
    reference: ticket.reference,
    subject: ticket.subject,
    body: ticket.body,
    agencyName: agency.name,
    raisedByName: ticket.created_by_name,
    raisedByEmail: ticket.created_by_email,
    categoryLabel: CATEGORY_LABELS[ticket.category],
    priorityLabel: PRIORITY_LABELS[ticket.priority],
    attachmentCount,
    pageUrl: ticket.page_url,
    adminUrl: adminTicketUrl(ticket.id),
  });
  await sendAgencyEmail({
    agency,
    to,
    ...email,
    // Reply-to the raiser, which also means an agency with no contact_email
    // can still reach us (the default reply-to would throw).
    replyTo: ticket.created_by_email,
    templateKey: "support_ticket_raised",
  });
}

export async function notifyPlatformOfAgencyReply(
  ticket: Pick<TicketBundle, "id" | "tenant_id" | "reference" | "subject" | "created_by_email">,
  authorName: string,
  body: string,
  attachmentCount: number
): Promise<void> {
  const to = platformInbox();
  if (!to) {
    console.warn("[helpdesk.email] PLATFORM_SUPPORT_EMAIL is not set; skipping reply email", ticket.reference);
    return;
  }
  const agency = await loadAgency(ticket.tenant_id);
  if (!agency) return;
  const email = generateSupportTicketAgencyReplyEmail({
    reference: ticket.reference,
    subject: ticket.subject,
    agencyName: agency.name,
    authorName,
    body,
    attachmentCount,
    adminUrl: adminTicketUrl(ticket.id),
  });
  await sendAgencyEmail({
    agency,
    to,
    ...email,
    replyTo: ticket.created_by_email,
    templateKey: "support_ticket_agency_reply",
  });
}

export async function notifyAgencyOfPlatformReply(
  ticket: Pick<TicketBundle, "id" | "tenant_id" | "reference" | "subject" | "created_by_name" | "created_by_email">,
  body: string,
  status: TicketStatus
): Promise<void> {
  const agency = await loadAgency(ticket.tenant_id);
  if (!agency) return;
  const email = generateSupportTicketPlatformReplyEmail({
    reference: ticket.reference,
    subject: ticket.subject,
    recipientName: ticket.created_by_name,
    body,
    statusLabel: STATUS_LABELS[status],
    ticketUrl: await getTenantAppUrl(ticket.tenant_id, `/helpdesk/${ticket.id}`),
  });
  await sendAgencyEmail({
    agency,
    to: ticket.created_by_email,
    ...email,
    ...(platformInbox() ? { replyTo: platformInbox()! } : {}),
    templateKey: "support_ticket_platform_reply",
  });
}

export async function notifyAgencyOfStatusChange(
  ticket: Pick<TicketBundle, "id" | "tenant_id" | "reference" | "subject" | "created_by_name" | "created_by_email">,
  status: TicketStatus
): Promise<void> {
  const agency = await loadAgency(ticket.tenant_id);
  if (!agency) return;
  const email = generateSupportTicketStatusEmail({
    reference: ticket.reference,
    subject: ticket.subject,
    recipientName: ticket.created_by_name,
    statusLabel: STATUS_LABELS[status],
    ticketUrl: await getTenantAppUrl(ticket.tenant_id, `/helpdesk/${ticket.id}`),
  });
  await sendAgencyEmail({
    agency,
    to: ticket.created_by_email,
    ...email,
    ...(platformInbox() ? { replyTo: platformInbox()! } : {}),
    templateKey: "support_ticket_status",
  });
}
