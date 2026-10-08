import type { HelpArticle } from "../domain/types";

export const invoicesArticle: HelpArticle = {
  slug: "invoices",
  title: "Invoices",
  route: "/invoices",
  match: "prefix",
  summary: "Create, finalise, email, and track invoices to landlords.",
  content: `## What this page is for

Invoices is your billing centre. It lists every invoice with its status — **Draft**, **Ready to send**, **Sent**, **Paid**, **Declined** or **Void** (older invoices may also show **Approved**) — and is where you raise them and email them to landlords.

## How an invoice moves

1. **Draft.** A new invoice starts as a draft. You can edit it, and it can never be emailed while it is a draft.
2. **Finalise.** Open the invoice and click **Finalise** once the line items and dates are right. It becomes **Ready to send**. There is no admin approval step — the person who created the invoice, or any admin, can finalise and send it.
3. **Send invoice.** Click **Send invoice** to open the email. Review the subject and message (pre-filled from your agency's invoice email), switch to **Preview** to see the branded email, then send. The invoice PDF is attached automatically and the invoice becomes **Sent**. Any bonuses on the invoice are marked sent too.
4. **Resend.** A sent invoice shows **Resend invoice** — use it if the landlord lost the email or the invoice changed. It always attaches the current PDF.
5. **Mark paid / Decline.** Admins record the outcome with **Mark paid** or **Decline**; linked bonuses follow.

## Key tasks

- **Create an invoice.** Use **New Invoice** to build one from scratch, or generate one from approved [bonuses](/bonuses) via **Create Invoice from bonuses**.
- **Search and filter.** Search by invoice number or landlord and filter by status.
- **View the PDF.** **View PDF** on any invoice. The PDF is rebuilt whenever the invoice is edited or finalised, so it always matches what you see.
- **Bulk manage.** Select multiple draft invoices to delete in bulk.
- **Export.** Download invoice data with **Export**.

## Tips

- **No landlord email?** When you click Send and the landlord has no email on file, you are asked to add one. It is saved to the landlord's record so future invoices go straight through — or cancel and send later.
- **Send from your own address.** Invoices go out through your agency's connected mailbox (Microsoft 365, Gmail or SMTP) when an admin has set one up in [Email Sending](/settings/email). Otherwise they come from the shared Harbor Ops mailer, with replies going to your billing profile's sender email.
- **Change the default wording.** Admins edit the invoice email on the [Billing](/settings/billing-profiles) page. Merge fields such as \`{{invoice_number}}\`, \`{{balance_due}}\`, \`{{due_date}}\`, \`{{landlord_name}}\` and \`{{billing_company}}\` are filled in for each invoice. Edits made in the send dialog apply to that one email only.
- Invoices use your **Billing Profiles** (sender details, bank info, logo) — set those up under [Billing Profiles](/settings/billing-profiles).
- Agents see and send their own invoices; admins see and manage all.`,
};
