const PRIORITY_LABEL: Record<string, string> = {
  critical: "Priority: Emergency (P0)",
  high: "Priority: Urgent",
  medium: "Priority: Normal",
  low: "Priority: Low",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  pending_parts: "Pending parts",
  pending_quote: "Pending quote",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

const EMERGENCY_LABEL: Record<string, string> = {
  gas: "Suspected gas leak",
  fire: "Fire / smoke",
  water: "Active flood / major water leak",
  electric: "Electrical hazard",
  lockout: "Lockout",
  no_heat_cold: "No heating in cold weather",
};

function truncate(text: string, max = 300): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;">
${bodyHtml}
</body></html>`;
}

// ───────────────────────────────────────────────────────────────
// Tenant confirmation (on ticket creation)
// ───────────────────────────────────────────────────────────────

export type TicketConfirmationParams = {
  reference: string;
  tenantFirstName: string;
  descriptionPreview: string;
  priority: "critical" | "high" | "medium" | "low";
  propertyAddress: string;
  roomLabel: string;
};

export function generateTicketConfirmationEmail(
  p: TicketConfirmationParams
): { subject: string; html: string; text: string } {
  const subject = `Maintenance request received — ${p.reference}`;
  const priorityLine = PRIORITY_LABEL[p.priority] ?? "Priority: Normal";
  const summary = truncate(p.descriptionPreview);

  const text = `Hi ${p.tenantFirstName},

We've received your maintenance request.

Reference: ${p.reference}
${priorityLine}
Property: ${p.propertyAddress}
Room: ${p.roomLabel}

What you reported:
${summary}

Your landlord has been notified and will take it from here. You'll get another email when the status changes.

Thanks,
Maintenance Team`;

  const html = wrapHtml(
    subject,
    `<p>Hi ${p.tenantFirstName},</p>
<p>We've received your maintenance request.</p>
<table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Reference</td><td><strong>${p.reference}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">${priorityLine.split(":")[0]}</td><td>${priorityLine.split(":").slice(1).join(":").trim()}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Property</td><td>${p.propertyAddress}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Room</td><td>${p.roomLabel}</td></tr>
</table>
<p style="color:#333;"><strong>What you reported</strong></p>
<blockquote style="margin:0;padding:12px 16px;border-left:3px solid #e5e7eb;background:#f9fafb;color:#333;">${summary}</blockquote>
<p>Your landlord has been notified and will take it from here. You'll get another email when the status changes.</p>
<p style="color:#666;font-size:14px;margin-top:32px;">— Maintenance Team</p>`
  );

  return { subject, html, text };
}

// ───────────────────────────────────────────────────────────────
// Tenant status change
// ───────────────────────────────────────────────────────────────

export type TicketStatusChangeParams = {
  reference: string;
  tenantFirstName: string;
  descriptionPreview: string;
  oldStatus: string;
  newStatus: string;
};

const STATUS_COPY: Record<
  string,
  { subjectTail: string; body: string } | undefined
> = {
  acknowledged: {
    subjectTail: "we've seen your request",
    body: "Your landlord has reviewed the request and will arrange next steps.",
  },
  in_progress: {
    subjectTail: "work is underway",
    body: "A handyman has been assigned and work is underway.",
  },
  resolved: {
    subjectTail: "is resolved",
    body: "This request is marked resolved. If the issue isn't actually fixed, reply to this email or raise a new request.",
  },
  cancelled: {
    subjectTail: "cancelled",
    body: "This request has been cancelled. Raise a new one if needed.",
  },
};

export function generateTicketStatusChangeEmail(
  p: TicketStatusChangeParams
): { subject: string; html: string; text: string } | null {
  const copy = STATUS_COPY[p.newStatus];
  if (!copy) return null;

  const subject =
    p.newStatus === "resolved" || p.newStatus === "cancelled"
      ? `${p.reference} ${copy.subjectTail}`
      : `Update on ${p.reference}: ${copy.subjectTail}`;

  const summary = truncate(p.descriptionPreview);
  const statusLabel = STATUS_LABEL[p.newStatus] ?? p.newStatus;

  const text = `Hi ${p.tenantFirstName},

${copy.body}

Reference: ${p.reference}
Current status: ${statusLabel}

Original request:
${summary}

— Maintenance Team`;

  const html = wrapHtml(
    subject,
    `<p>Hi ${p.tenantFirstName},</p>
<p>${copy.body}</p>
<table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Reference</td><td><strong>${p.reference}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Current status</td><td>${statusLabel}</td></tr>
</table>
<p style="color:#333;"><strong>Original request</strong></p>
<blockquote style="margin:0;padding:12px 16px;border-left:3px solid #e5e7eb;background:#f9fafb;color:#333;">${summary}</blockquote>
<p style="color:#666;font-size:14px;margin-top:32px;">— Maintenance Team</p>`
  );

  return { subject, html, text };
}

// ───────────────────────────────────────────────────────────────
// Landlord P0 alert
// ───────────────────────────────────────────────────────────────

export type LandlordP0AlertParams = {
  reference: string;
  emergencyType: string;
  propertyAddress: string;
  roomLabel: string;
  pmTenantFullName: string;
  pmTenantPhone: string;
  pmTenantEmail: string;
  descriptionPreview: string;
  ticketUrl: string | null;
};

export function generateLandlordP0AlertEmail(
  p: LandlordP0AlertParams
): { subject: string; html: string; text: string } {
  const subject = `⚠️ P0 Maintenance: ${p.propertyAddress}`;
  const emergencyLabel = EMERGENCY_LABEL[p.emergencyType] ?? p.emergencyType;
  const summary = truncate(p.descriptionPreview);
  const linkLine = p.ticketUrl ? `\nView ticket: ${p.ticketUrl}` : "";

  const text = `EMERGENCY — ${emergencyLabel}

Property: ${p.propertyAddress}
Room: ${p.roomLabel}
Tenant: ${p.pmTenantFullName}
Tenant phone: ${p.pmTenantPhone}
Tenant email: ${p.pmTenantEmail}
Reference: ${p.reference}
${linkLine}

Reported:
${summary}

This is an automated P0 alert from the maintenance triage system.`;

  const linkHtml = p.ticketUrl
    ? `<p style="margin:16px 0;"><a href="${p.ticketUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">View ticket in Maintenance</a></p>`
    : "";

  const html = wrapHtml(
    subject,
    `<div style="background:#dc2626;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
  <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Emergency alert</p>
  <p style="margin:4px 0 0;font-size:18px;font-weight:700;">${emergencyLabel}</p>
</div>
<table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Property</td><td>${p.propertyAddress}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Room</td><td>${p.roomLabel}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Tenant</td><td>${p.pmTenantFullName}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Phone</td><td><a href="tel:${p.pmTenantPhone.replace(/\s+/g, "")}">${p.pmTenantPhone}</a></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:${p.pmTenantEmail}">${p.pmTenantEmail}</a></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Reference</td><td><strong>${p.reference}</strong></td></tr>
</table>
<p style="color:#333;"><strong>Reported</strong></p>
<blockquote style="margin:0;padding:12px 16px;border-left:3px solid #dc2626;background:#fef2f2;color:#333;">${summary}</blockquote>
${linkHtml}
<p style="color:#999;font-size:12px;margin-top:32px;">Automated P0 alert from the maintenance triage system.</p>`
  );

  return { subject, html, text };
}

// ───────────────────────────────────────────────────────────────
// Property manager new-ticket notification (every ticket)
// ───────────────────────────────────────────────────────────────

export type PropertyManagerTicketParams = {
  reference: string;
  priority: "critical" | "high" | "medium" | "low";
  propertyAddress: string;
  roomLabel: string;
  pmTenantFullName: string;
  pmTenantPhone: string | null;
  pmTenantEmail: string | null;
  managerFirstName: string | null;
  descriptionPreview: string;
  ticketUrl: string | null;
  isEmergency: boolean;
  emergencyType: string | null;
};

export function generatePropertyManagerTicketEmail(
  p: PropertyManagerTicketParams
): { subject: string; html: string; text: string } {
  const priorityLine = PRIORITY_LABEL[p.priority] ?? "Priority: Normal";
  const emergencyLabel =
    p.isEmergency && p.emergencyType
      ? EMERGENCY_LABEL[p.emergencyType] ?? p.emergencyType
      : null;
  const summary = truncate(p.descriptionPreview);
  const greeting = p.managerFirstName ? `Hi ${p.managerFirstName},` : "Hi,";
  const subject = p.isEmergency
    ? `⚠️ New maintenance ticket — ${p.propertyAddress} (${p.reference})`
    : `New maintenance ticket — ${p.propertyAddress} (${p.reference})`;

  const phoneLine = p.pmTenantPhone ? `Tenant phone: ${p.pmTenantPhone}\n` : "";
  const emailLine = p.pmTenantEmail ? `Tenant email: ${p.pmTenantEmail}\n` : "";
  const linkLine = p.ticketUrl ? `\nView ticket: ${p.ticketUrl}` : "";
  const emergencyIntro = emergencyLabel
    ? `EMERGENCY — ${emergencyLabel}\n\n`
    : "";

  const text = `${greeting}

${emergencyIntro}A new maintenance ticket has been raised for a property you manage.

Reference: ${p.reference}
${priorityLine}
Property: ${p.propertyAddress}
Room: ${p.roomLabel}
Tenant: ${p.pmTenantFullName}
${phoneLine}${emailLine}
Reported:
${summary}
${linkLine}

— Maintenance Team`;

  const emergencyBanner = emergencyLabel
    ? `<div style="background:#dc2626;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
  <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Emergency</p>
  <p style="margin:4px 0 0;font-size:18px;font-weight:700;">${emergencyLabel}</p>
</div>`
    : "";

  const phoneRow = p.pmTenantPhone
    ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Phone</td><td><a href="tel:${p.pmTenantPhone.replace(/\s+/g, "")}">${p.pmTenantPhone}</a></td></tr>`
    : "";
  const emailRow = p.pmTenantEmail
    ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:${p.pmTenantEmail}">${p.pmTenantEmail}</a></td></tr>`
    : "";

  const linkHtml = p.ticketUrl
    ? `<p style="margin:16px 0;"><a href="${p.ticketUrl}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">View ticket in Maintenance</a></p>`
    : "";

  const html = wrapHtml(
    subject,
    `<p>${greeting}</p>
${emergencyBanner}
<p>A new maintenance ticket has been raised for a property you manage.</p>
<table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Reference</td><td><strong>${p.reference}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">${priorityLine.split(":")[0]}</td><td>${priorityLine.split(":").slice(1).join(":").trim()}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Property</td><td>${p.propertyAddress}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Room</td><td>${p.roomLabel}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;">Tenant</td><td>${p.pmTenantFullName}</td></tr>
  ${phoneRow}
  ${emailRow}
</table>
<p style="color:#333;"><strong>Reported</strong></p>
<blockquote style="margin:0;padding:12px 16px;border-left:3px solid #e5e7eb;background:#f9fafb;color:#333;">${summary}</blockquote>
${linkHtml}
<p style="color:#666;font-size:14px;margin-top:32px;">— Maintenance Team</p>`
  );

  return { subject, html, text };
}
