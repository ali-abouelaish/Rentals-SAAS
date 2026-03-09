export type InvoiceEmailParams = {
  invoiceNumber: string;
  tenantName?: string;
};

export function generateInvoiceEmail({
  invoiceNumber,
  tenantName = "Customer",
}: InvoiceEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Invoice #${invoiceNumber}`;
  const greeting = tenantName ? `Hi ${tenantName},` : "Hi,";

  const text = `${greeting}

You have received Invoice #${invoiceNumber}.

Please view the attached details or log in to your account to view and pay this invoice.

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
  <p style="margin-bottom: 16px;">${greeting}</p>
  <p style="margin-bottom: 16px;">You have received <strong>Invoice #${invoiceNumber}</strong>.</p>
  <p style="margin-bottom: 24px;">Please view the attached details or log in to your account to view and pay this invoice.</p>
  <p style="margin-bottom: 0; color: #666; font-size: 14px;">If you have any questions, please contact us.</p>
</body>
</html>
`.trim();

  return { subject, html, text };
}
