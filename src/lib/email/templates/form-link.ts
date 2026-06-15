export type FormLinkEmailParams = {
  formName: string;
  formUrl: string;
  agencyName: string;
};

export function generateFormLinkEmail({
  formName,
  formUrl,
  agencyName,
}: FormLinkEmailParams): { subject: string; html: string; text: string } {
  const subject = `You have a form to complete: ${formName}`;

  const text = `Hi,

${agencyName} has sent you a form to complete: ${formName}

Please follow the link below to fill it out:
${formUrl}

If you have any questions, please contact us.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="margin-bottom: 16px;">Hi,</p>
  <p style="margin-bottom: 16px;"><strong>${agencyName}</strong> has sent you a form to complete.</p>
  <p style="margin-bottom: 24px; font-size: 18px; font-weight: 600;">${formName}</p>
  <p style="margin-bottom: 24px;">
    <a
      href="${formUrl}"
      style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 15px;"
    >
      Complete form
    </a>
  </p>
  <p style="margin-bottom: 8px; color: #666; font-size: 13px;">
    Or copy and paste this link into your browser:
  </p>
  <p style="margin-bottom: 24px; color: #666; font-size: 13px; word-break: break-all;">
    ${formUrl}
  </p>
  <p style="margin-bottom: 0; color: #999; font-size: 13px;">
    If you have any questions, please contact us.
  </p>
</body>
</html>
`.trim();

  return { subject, html, text };
}
