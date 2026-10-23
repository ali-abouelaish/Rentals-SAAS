import type { HelpArticle } from "../domain/types";

export const leadsArticle: HelpArticle = {
  slug: "leads",
  title: "Leads",
  route: "/leads",
  match: "prefix",
  summary: "Inbound enquiries from property portals, your own website and agents' business cards.",
  content: `## What this page is for

Leads collects inbound enquiries in one place. They arrive three ways:

- **Property portals** (Zoopla, Rightmove), parsed automatically from portal enquiry emails in a connected Gmail inbox.
- **Your own website.** Once a website is connected under Leads → Settings, each enquiry form submission arrives instantly with a **Website** badge.
- **Business cards.** Enquiries sent from an agent's digital business card.

The stats card shows your capture numbers and Gmail connection health.

## Key tasks

1. **Review incoming leads.** Each lead appears as a card; click it to open the detail. A blue dot marks leads nobody has opened yet.
2. **Filter.** Narrow by status and by source (Website, Business card, or the portals you've configured), and search by name, email or phone.
3. **See where a website lead came from.** A website lead names the website that sent it next to its source (e.g. "via Main website"), and **View page on website** opens the page the enquiry was sent from.
4. **Configure capture (admin).** Open **Settings** (top-right) to connect Gmail, manage portal platforms, and connect your website.

## Tips

- If no leads are appearing, an admin may need to **Connect Gmail** or **Connect a website** from Leads → Settings.
- A lead sent with only a phone number shows the phone instead of an email.
- Anything extra the visitor filled in on your website form (budget, move-in date…) is added to the lead's message, so nothing is lost.
- The AI assistant can read the name, email and phone of website and business-card leads. Leads imported from Gmail stay private to it: it sees only their status, portal and date.
- Convert a promising lead into a [Client](/clients) to start the rental process.`,
};
