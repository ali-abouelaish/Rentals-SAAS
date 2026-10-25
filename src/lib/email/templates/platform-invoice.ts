// Platform invoice: Harbor billing an agency. Every other invoice-ish email is
// an agency writing to its own people and carries agency branding; this one is
// us writing to the agency, so it carries ours (see ../harbor.ts).

import { callout, esc, facts, harborEmail, label, note, paragraph, strong } from "../harbor";

export type PlatformInvoiceEmailContext = {
  agencyName: string;
  invoiceNumber: string | null;
  periodLabel: string;
  totalAmount: string;
  lineSummary: { description: string; amount: string }[];
  paymentNote: string | null;
};

export function renderPlatformInvoiceEmail(ctx: PlatformInvoiceEmailContext): string {
  const title = ctx.invoiceNumber
    ? `Harbor invoice ${ctx.invoiceNumber}`
    : `Harbor invoice for ${ctx.periodLabel}`;

  const summary: [string, string][] = [];
  if (ctx.invoiceNumber) summary.push(["Invoice", ctx.invoiceNumber]);
  summary.push(["Period", ctx.periodLabel], ["Total", ctx.totalAmount]);

  const lines =
    ctx.lineSummary.length > 0
      ? label("What’s on it") +
        facts(ctx.lineSummary.map((line) => [line.description, line.amount] as const))
      : "";

  return harborEmail({
    title,
    preheader: `${ctx.totalAmount} for ${ctx.periodLabel}. The full breakdown is attached as a PDF.`,
    eyebrow: ctx.invoiceNumber ? `Invoice ${ctx.invoiceNumber}` : "Invoice",
    headline: [`Your invoice for ${ctx.periodLabel}.`, `${ctx.totalAmount} in total.`],
    html:
      paragraph(`Hi ${esc(ctx.agencyName)},`) +
      paragraph(
        `Here’s your Harbor invoice for ${strong(ctx.periodLabel)}. The full breakdown is attached as a PDF.`
      ) +
      facts(summary, { emphasiseLast: true }) +
      lines +
      (ctx.paymentNote ? callout(esc(ctx.paymentNote), "info") : "") +
      note("Questions about a charge? Reply to this email and we’ll go through it with you."),
    footnote: "Sent to the billing email on your Harbor workspace.",
  });
}
