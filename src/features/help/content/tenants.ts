import type { HelpArticle } from "../domain/types";

export const tenantsArticle: HelpArticle = {
  slug: "tenants",
  title: "Tenants",
  route: "/tenants",
  match: "prefix",
  summary: "Maintain tenant profiles, right-to-rent, guarantors, and documents.",
  content: `## What this page is for

Tenants holds the people living in your managed units — their contact details, right-to-rent status, guarantors, and uploaded documents. It also surfaces each tenant's rent-reminder status.

## Key tasks

1. **Add a tenant.** Create a tenant record with their name and contact details. (Tenants are also created automatically when you convert an application in [Bookings](/bookings).)
2. **Open a tenant.** Click a tenant to open their drawer and edit their details.
3. **Track right to rent.** Record and update the tenant's right-to-rent check status.
4. **Manage guarantors.** Add, edit, or delete guarantors against a tenant.
5. **Upload documents.** Attach documents (IDs, references, etc.) to the tenant's record.
6. **Review reminder history.** Open a tenant's **rent reminders** page to see every reminder email sent, its type, the rent period, and delivery status.
7. **Send a portal link.** In the tenant's drawer, **Portal link** emails them a sign-in link for the tenant portal.

## Tenant portal

Tenants can sign in to a self-service portal at \`/portal\` on your workspace address. There they can see their tenancy summary, rent status and payment history, their unique bank standing-order payment reference, their maintenance requests (and report new ones), deposit protection status, and your contact details.

- Sign-in is passwordless: the tenant enters their email (the one on their record here) and receives a link that's valid for 20 minutes. You can also send one directly with the **Portal link** button in the tenant drawer.
- If a tenant can't sign in, check the email on their record matches the address they're using.
- The portal is read-only — tenants can't change any records, only view them and raise maintenance requests.

## Tips

- Rent reminders are sent automatically by a daily job; the reminders page is a read-only history.
- If a tenant requests an email change, it appears in the [Inbox](/inbox) for you to approve.
- A tenant must be linked to an active/signed contract to appear in [Rent Collection](/rent-collection).`,
};
