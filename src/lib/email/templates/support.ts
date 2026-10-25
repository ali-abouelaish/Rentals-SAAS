// Email templates for agency → Harbor support tickets (/helpdesk).
// Each generator returns { subject, html, text }, like templates/maintenance.ts.

import { button, callout, chip, esc, facts, harborEmail, note, paragraph, quote, strong } from "../harbor";

type Email = { subject: string; html: string; text: string };

function truncate(text: string, max = 1500): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

// ── → Harbor ────────────────────────────────────────────

export type SupportTicketRaisedParams = {
  reference: string;
  subject: string;
  body: string;
  agencyName: string;
  raisedByName: string;
  raisedByEmail: string;
  categoryLabel: string;
  priorityLabel: string;
  attachmentCount: number;
  pageUrl: string | null;
  adminUrl: string;
};

export function generateSupportTicketRaisedEmail(p: SupportTicketRaisedParams): Email {
  const urgent = p.priorityLabel.toLowerCase().startsWith("urgent");
  const subject = `${urgent ? "[URGENT] " : ""}[${p.reference}] ${p.agencyName}: ${p.subject}`;
  const meta = [
    `Agency: ${p.agencyName}`,
    `Raised by: ${p.raisedByName} <${p.raisedByEmail}>`,
    `Category: ${p.categoryLabel}`,
    `Priority: ${p.priorityLabel}`,
    p.attachmentCount > 0 ? `Attachments: ${p.attachmentCount}` : "",
    p.pageUrl ? `Came from: ${p.pageUrl}` : "",
  ].filter(Boolean);

  const rows: [string, string][] = [
    ["Agency", p.agencyName],
    ["Raised by", `${p.raisedByName} <${p.raisedByEmail}>`],
    ["Category", p.categoryLabel],
    ["Priority", p.priorityLabel],
  ];
  if (p.attachmentCount > 0) rows.push(["Attachments", String(p.attachmentCount)]);
  if (p.pageUrl) rows.push(["Came from", p.pageUrl]);

  const html = harborEmail({
    title: subject,
    preheader: `${p.agencyName}: ${p.subject}`,
    eyebrow: `Help desk · ${p.reference}`,
    headline: ["New support ticket.", `From ${p.agencyName}.`],
    html:
      (urgent ? callout("Marked urgent by the agency.", "notice") : "") +
      paragraph(strong(p.subject)) +
      quote(truncate(p.body)) +
      facts(rows) +
      button(p.adminUrl, "Open in admin") +
      note(
        `Replying to this email goes to ${esc(p.raisedByEmail)} directly and is not recorded on the ticket. Reply from the admin console to keep the thread.`
      ),
    footnote: "Sent to the Harbor support inbox.",
  });
  const text = [`New support ticket ${p.reference}`, p.subject, "", ...meta, "", truncate(p.body), "", `Open: ${p.adminUrl}`].join(
    "\n"
  );
  return { subject, html, text };
}

export type SupportAgencyReplyParams = {
  reference: string;
  subject: string;
  agencyName: string;
  authorName: string;
  body: string;
  attachmentCount: number;
  adminUrl: string;
};

export function generateSupportTicketAgencyReplyEmail(p: SupportAgencyReplyParams): Email {
  const subject = `Re: [${p.reference}] ${p.agencyName}: ${p.subject}`;
  const html = harborEmail({
    title: subject,
    preheader: truncate(p.body, 120),
    eyebrow: `Help desk · ${p.reference}`,
    headline: [`${p.authorName} replied.`, `From ${p.agencyName}.`],
    html:
      paragraph(strong(p.subject)) +
      quote(truncate(p.body)) +
      (p.attachmentCount > 0
        ? note(`${p.attachmentCount} attachment${p.attachmentCount === 1 ? "" : "s"} on the ticket.`)
        : "") +
      button(p.adminUrl, "Open in admin"),
    footnote: "Sent to the Harbor support inbox.",
  });
  const text = [
    `${p.authorName} (${p.agencyName}) replied on ${p.reference}:`,
    "",
    truncate(p.body),
    "",
    `Open: ${p.adminUrl}`,
  ].join("\n");
  return { subject, html, text };
}

// ── → the agency user who raised it ─────────────────────────

export type SupportPlatformReplyParams = {
  reference: string;
  subject: string;
  recipientName: string;
  body: string;
  statusLabel: string;
  ticketUrl: string;
};

export function generateSupportTicketPlatformReplyEmail(p: SupportPlatformReplyParams): Email {
  const subject = `Re: [${p.reference}] ${p.subject}`;
  const html = harborEmail({
    title: subject,
    preheader: truncate(p.body, 120),
    eyebrow: `Help desk · ${p.reference}`,
    headline: ["Harbor Support replied.", "Your ticket has an answer."],
    html:
      paragraph(`Hi ${esc(p.recipientName)},`) +
      paragraph(`Here’s our reply on ${strong(p.reference)}, “${esc(p.subject)}”:`) +
      quote(truncate(p.body)) +
      facts([["Status", { html: chip(p.statusLabel) }]]) +
      button(p.ticketUrl, "View and reply") +
      note("Please reply from the link above so your answer is kept on the ticket."),
    footnote: "Sent because you raised this ticket from your Harbor workspace.",
  });
  const text = [
    `Hi ${p.recipientName},`,
    "",
    `Harbor Support replied to your ticket ${p.reference}:`,
    "",
    truncate(p.body),
    "",
    `Status: ${p.statusLabel}`,
    `View and reply: ${p.ticketUrl}`,
  ].join("\n");
  return { subject, html, text };
}

export type SupportStatusChangeParams = {
  reference: string;
  subject: string;
  recipientName: string;
  statusLabel: string;
  ticketUrl: string;
};

export function generateSupportTicketStatusEmail(p: SupportStatusChangeParams): Email {
  const subject = `[${p.reference}] is now ${p.statusLabel}`;
  const html = harborEmail({
    title: subject,
    preheader: `${p.subject}: now ${p.statusLabel}.`,
    eyebrow: `Help desk · ${p.reference}`,
    headline: ["Your ticket has moved on.", `It’s now ${p.statusLabel.toLowerCase()}.`],
    html:
      paragraph(`Hi ${esc(p.recipientName)},`) +
      paragraph(`Your support ticket ${strong(p.reference)}, “${esc(p.subject)}”, is now ${strong(p.statusLabel)}.`) +
      button(p.ticketUrl, "View ticket") +
      note("If the problem isn’t fixed, reply on the ticket and it will re-open."),
    footnote: "Sent because you raised this ticket from your Harbor workspace.",
  });
  const text = [
    `Hi ${p.recipientName},`,
    "",
    `Your support ticket ${p.reference} ("${p.subject}") is now ${p.statusLabel}.`,
    "",
    `View ticket: ${p.ticketUrl}`,
  ].join("\n");
  return { subject, html, text };
}
