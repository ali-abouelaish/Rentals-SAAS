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
8. **Send a welcome email.** In the tenant's drawer, **Welcome email** sends your check-in pack — how to collect keys, how to use the portal, how rent is paid, and who to contact.

## Welcome emails

The **Welcome email** button in a tenant's drawer opens a preview of the email filled in with that tenant's real details, which you can adjust before sending. It goes out immediately from your agency's email address, with your logo, colours and footer applied automatically — there is nothing to style.

- **Changing the wording for everyone.** The copy lives in the **Welcome & check-in pack** template under [Automations → Templates](/automations/templates). Edit it there and every future send uses your version; **Reset to default** brings back the original wording. Editing the text inside the send dialog only affects that one send.
- **It is a designed HTML email.** You write the words; the layout, your logo, your brand colours, the property/rent panel at the top and the footer are applied automatically and cannot be edited or broken. Formatting uses a few plain-text marks: \`# Headline\` on the first line, \`## Section\` for a section, \`- \` for a bullet, \`**bold**\`, \`---\` for a divider, and \`[Label](link)\` alone on a line for a button. Anything else you type stays plain text — you cannot paste HTML in.
- **Check it before it goes.** The send dialog opens on a **Preview** tab showing the finished email exactly as the renter will see it. Switch to **Edit text** to change the wording, then back to Preview to re-render.
- **Placeholders.** {{renter_name}}, {{property_address}}, {{rent_amount}}, {{tenancy_start_date}} and the rest fill in per tenant. The starter copy leaves a spot for your out-of-hours emergency number — replace it in the template so every tenant gets it.
- **The portal link.** {{portal_link}} becomes a fresh sign-in link valid for 20 minutes, generated at the moment you press Send (not when you open the dialog, so it can't arrive expired). {{portal_url}} is the permanent login page for after it lapses.
- **Before they have a tenancy.** You can still send it, but rent and address placeholders will be blank — link the tenant to a contract first, or edit those lines out for that send.
- Sending a welcome email also counts as their portal invite, so you don't need to send both.

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
