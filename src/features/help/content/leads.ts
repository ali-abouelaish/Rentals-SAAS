import type { HelpArticle } from "../domain/types";

export const leadsArticle: HelpArticle = {
  slug: "leads",
  title: "Leads",
  route: "/leads",
  match: "prefix",
  summary: "Inbound enquiries captured automatically from property portals.",
  content: `## What this page is for

Leads collects inbound enquiries from property portals, parsed automatically from a connected Gmail inbox. The sync card shows your capture stats and connection health.

## Key tasks

1. **Review incoming leads.** Each lead appears as a card; click through for the detail.
2. **Filter.** Narrow by status and by source (the portals you've configured), and search to find a specific lead.
3. **Check sync status.** The stats card shows how many leads have been captured and whether Gmail is connected.
4. **Configure capture (admin).** Open **Settings** (top-right) to connect Gmail and manage the platform/source configurations that drive parsing.

## Tips

- If no leads are appearing, an admin may need to **Connect Gmail** from Leads → Settings.
- Sources in the filter come from the platform configurations set up in Settings.
- Convert a promising lead into a [Client](/clients) to start the rental process.`,
};
