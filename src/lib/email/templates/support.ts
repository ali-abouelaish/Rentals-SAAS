// Email templates for agency → Harbor Ops support tickets (/helpdesk).
// Each generator returns { subject, html, text }, like templates/maintenance.ts.

type Email = { subject: string; html: string; text: string };

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text: string, max = 1500): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;">
${bodyHtml}
<p style="margin-top:32px;font-size:12px;color:#888;">Harbor Ops Support</p>
</body></html>`;
}

function quote(body: string): string {
  return `<div style="white-space:pre-wrap;border-left:3px solid #ddd;padding:8px 12px;margin:16px 0;background:#fafafa;">${esc(
    truncate(body)
  )}</div>`;
}

function button(url: string, label: string): string {
  return `<p><a href="${esc(url)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">${esc(
    label
  )}</a></p>`;
}

// ── → Harbor Ops ────────────────────────────────────────────

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

  const html = wrapHtml(
    subject,
    `<h2 style="margin:0 0 8px;">New support ticket ${esc(p.reference)}</h2>
<p style="margin:0 0 4px;font-weight:600;">${esc(p.subject)}</p>
<p style="font-size:13px;color:#555;">${meta.map(esc).join("<br>")}</p>
${quote(p.body)}
${button(p.adminUrl, "Open in admin")}
<p style="font-size:12px;color:#888;">Replying to this email goes to ${esc(
      p.raisedByEmail
    )} directly and is NOT recorded on the ticket — reply from the admin console to keep the thread.</p>`
  );
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
  const html = wrapHtml(
    subject,
    `<p><strong>${esc(p.authorName)}</strong> (${esc(p.agencyName)}) replied on ${esc(p.reference)}:</p>
${quote(p.body)}
${p.attachmentCount > 0 ? `<p style="font-size:13px;color:#555;">+ ${p.attachmentCount} attachment(s)</p>` : ""}
${button(p.adminUrl, "Open in admin")}`
  );
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
  const html = wrapHtml(
    subject,
    `<p>Hi ${esc(p.recipientName)},</p>
<p>Harbor Ops Support replied to your ticket <strong>${esc(p.reference)}</strong>:</p>
${quote(p.body)}
<p style="font-size:13px;color:#555;">Status: ${esc(p.statusLabel)}</p>
${button(p.ticketUrl, "View and reply")}
<p style="font-size:12px;color:#888;">Please reply from the link above so your answer is kept on the ticket.</p>`
  );
  const text = [
    `Hi ${p.recipientName},`,
    "",
    `Harbor Ops Support replied to your ticket ${p.reference}:`,
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
  const html = wrapHtml(
    subject,
    `<p>Hi ${esc(p.recipientName)},</p>
<p>Your support ticket <strong>${esc(p.reference)}</strong> — “${esc(p.subject)}” — is now <strong>${esc(
      p.statusLabel
    )}</strong>.</p>
${button(p.ticketUrl, "View ticket")}
<p style="font-size:12px;color:#888;">If the problem isn't fixed, reply on the ticket and it will re-open.</p>`
  );
  const text = [
    `Hi ${p.recipientName},`,
    "",
    `Your support ticket ${p.reference} ("${p.subject}") is now ${p.statusLabel}.`,
    "",
    `View ticket: ${p.ticketUrl}`,
  ].join("\n");
  return { subject, html, text };
}
