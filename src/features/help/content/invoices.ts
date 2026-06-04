import type { HelpArticle } from "../domain/types";

export const invoicesArticle: HelpArticle = {
  slug: "invoices",
  title: "Invoices",
  route: "/invoices",
  match: "prefix",
  summary: "Create, approve, send, and track invoices to landlords.",
  content: `## What this page is for

Invoices is your billing centre. It lists every invoice with its status — draft, submitted, approved, sent, paid, declined, or void — and is where you raise and manage them.

## Key tasks

1. **Create an invoice.** Use **New Invoice** to build one from scratch, or generate one from approved [bonuses](/bonuses) via **Create Invoice from bonuses**.
2. **Search and filter.** Search by invoice number or landlord and filter by status.
3. **Open an invoice.** Click a row to view the detail, move it through its lifecycle, and view or download the PDF.
4. **Bulk manage.** Select multiple invoices to delete in bulk (where permitted).
5. **Export.** Download invoice data with **Export**.

## Tips

- Invoices use your **Billing Profiles** (sender details, bank info, logo) — set those up under [Billing Profiles](/settings/billing-profiles).
- Sending an invoice emails it to the landlord; track the response via its status here.
- Agents see their own invoices; admins see and manage all.`,
};
