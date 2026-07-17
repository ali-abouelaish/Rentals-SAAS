export type PortalLoginEmailParams = {
  agencyName: string;
  renterFirstName: string;
  /** Magic link: /portal/auth?token=... */
  loginUrl: string;
  /** Self-serve login page for after the link expires. */
  portalLoginUrl: string;
  /** True when staff sent the link (invite copy) vs renter self-serve. */
  invitedByAgency: boolean;
};

export function generatePortalLoginEmail({
  agencyName,
  renterFirstName,
  loginUrl,
  portalLoginUrl,
  invitedByAgency,
}: PortalLoginEmailParams): { subject: string; html: string; text: string } {
  const subject = invitedByAgency
    ? `${agencyName} has invited you to your tenant portal`
    : `Sign in to your tenant portal — ${agencyName}`;

  const intro = invitedByAgency
    ? `${agencyName} has set up a tenant portal where you can check your rent, maintenance requests, deposit protection and contact details.`
    : `Here is your sign-in link for the ${agencyName} tenant portal.`;

  const text = `Hi ${renterFirstName},

${intro}

Sign in here (this link expires in 20 minutes):
${loginUrl}

If the link has expired, request a new one at:
${portalLoginUrl}

If you weren't expecting this email you can safely ignore it.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="margin-bottom: 16px;">Hi ${renterFirstName},</p>
  <p style="margin-bottom: 24px;">${intro}</p>
  <p style="margin-bottom: 24px;">
    <a
      href="${loginUrl}"
      style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 15px;"
    >
      Sign in to your portal
    </a>
  </p>
  <p style="margin-bottom: 8px; color: #666; font-size: 13px;">
    Or copy and paste this link into your browser:
  </p>
  <p style="margin-bottom: 24px; color: #666; font-size: 13px; word-break: break-all;">
    ${loginUrl}
  </p>
  <p style="margin-bottom: 8px; color: #666; font-size: 13px;">
    This link expires in 20 minutes. If it has expired, request a new one at
    <a href="${portalLoginUrl}" style="color: #666;">${portalLoginUrl}</a>.
  </p>
  <p style="margin-bottom: 0; color: #999; font-size: 13px;">
    If you weren't expecting this email you can safely ignore it.
  </p>
</body>
</html>
`.trim();

  return { subject, html, text };
}
