import "server-only";

import { renderMessageBody } from "@/lib/email/blocks";
import { templates } from "@/lib/email/render";
import type { AgencyBrand } from "@/lib/branding/agency-brand";
import { renderTemplate } from "@/features/automations/lib/render";
import { formatDate, formatGBP } from "@/lib/utils/formatters";

/** The invoice fields the email needs — a subset of the invoices row + joins. */
export type InvoiceEmailSource = {
  invoice_number: string;
  total: number | string;
  balance_due: number | string;
  issue_date: string;
  due_date: string;
  landlords?: { name?: string | null } | null;
  billing_profiles?: { sender_company_name?: string | null } | null;
};

/** Merge values for one invoice, keyed by INVOICE_MERGE_FIELDS. */
export function invoiceMergeContext(
  invoice: InvoiceEmailSource,
  agencyName: string
): Record<string, string> {
  return {
    landlord_name: invoice.landlords?.name?.trim() || "Landlord",
    invoice_number: invoice.invoice_number,
    total: formatGBP(Number(invoice.total)),
    balance_due: formatGBP(Number(invoice.balance_due)),
    issue_date: invoice.issue_date ? formatDate(invoice.issue_date) : "",
    due_date: invoice.due_date ? formatDate(invoice.due_date) : "",
    billing_company: invoice.billing_profiles?.sender_company_name?.trim() || agencyName,
    agency_name: agencyName,
  };
}

/** Fill merge fields in a subject + body, reporting keys with no value. */
export function fillInvoiceTemplate(
  template: { subject: string; body: string },
  context: Record<string, string>
): { subject: string; body: string; unknownKeys: string[] } {
  const subject = renderTemplate(template.subject, context);
  const body = renderTemplate(template.body, context);
  return {
    subject: subject.text,
    body: body.text,
    unknownKeys: [...new Set([...subject.unknownKeys, ...body.unknownKeys])],
  };
}

/**
 * Agency copy + agency branding → the finished invoice email. The agency only
 * supplies body markup; renderMessageBody escapes it, so nothing they type can
 * reach the email as raw HTML. The key facts are read from the invoice itself
 * and shown in a panel above the message.
 */
export function composeInvoiceEmail(opts: {
  brand: AgencyBrand;
  contactEmail: string | null;
  subject: string;
  body: string;
  context: Record<string, string>;
}): { html: string; text: string } {
  const { brand, context } = opts;
  const rendered = renderMessageBody(opts.body, {
    primaryColor: brand.branding.primary_color,
    linkColor: brand.secondaryColor ?? brand.branding.primary_color,
  });

  const facts = [
    { label: "Invoice", value: context.invoice_number ?? "" },
    { label: "Amount due", value: context.balance_due ?? "" },
    { label: "Due date", value: context.due_date ?? "" },
    { label: "Issued", value: context.issue_date ?? "" },
  ].filter((f) => f.value.trim() !== "");
  const factRows: { label: string; value: string }[][] = [];
  for (let i = 0; i < facts.length; i += 2) {
    factRows.push(facts.slice(i, i + 2));
  }

  const html = templates.agencyMessage({
    agency: {
      name: brand.displayName,
      initial: (brand.displayName.trim()[0] ?? "?").toUpperCase(),
      logo_url: brand.branding.logo_url,
      primary_color: brand.branding.primary_color,
      footer_address: brand.branding.footer_address,
      contact_email: opts.contactEmail,
    },
    eyebrow: "Invoice",
    headline: rendered.headline,
    factRows,
    bodyHtml: rendered.html,
    preheader: opts.subject,
  });

  const signoff = [brand.displayName, opts.contactEmail ?? "", brand.branding.footer_address]
    .filter((line) => line.trim() !== "")
    .join("\n");
  const text = [
    rendered.headline ?? "",
    facts.map((f) => `${f.label}: ${f.value}`).join("\n"),
    rendered.text,
    signoff ? `—\n${signoff}` : "",
  ]
    .filter((section) => section.trim() !== "")
    .join("\n\n");

  return { html, text };
}
