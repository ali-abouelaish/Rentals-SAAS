import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION ?? "eu-west-1",
});

export type SendEmailSESParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | string[];
};

/**
 * Send an email via SES. Accepts subject/html/text from template helpers
 * (e.g. generateInvoiceEmail) or custom content.
 */
export async function sendEmailSES({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailSESParams): Promise<{ messageId: string }> {
  const fromName = process.env.SES_FROM_NAME ?? "";
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("SES_FROM_EMAIL is not set");
  }
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const toAddresses = Array.isArray(to) ? to : [to];
  const replyToAddresses = replyTo
    ? Array.isArray(replyTo)
      ? replyTo
      : [replyTo]
    : undefined;

  const command = new SendEmailCommand({
    FromEmailAddress: from,
    Destination: {
      ToAddresses: toAddresses,
    },
    ReplyToAddresses: replyToAddresses,
    Content: {
      Simple: {
        Subject: {
          Data: subject,
        },
        Body: {
          ...(html && { Html: { Data: html } }),
          ...(text && { Text: { Data: text } }),
        },
      },
    },
  });

  const response = await sesClient.send(command);
  const messageId = response.MessageId;
  if (!messageId) {
    throw new Error("SES did not return a MessageId");
  }
  return { messageId };
}
