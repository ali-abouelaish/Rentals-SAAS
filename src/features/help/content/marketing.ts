import type { HelpArticle } from "../domain/types";

export const marketingArticle: HelpArticle = {
  slug: "marketing",
  title: "Marketing",
  route: "/marketing",
  match: "prefix",
  summary: "Advertise vacant units and track enquiries (coming soon).",
  content: `## What this page is for

Marketing is where you'll advertise vacant units, manage listings, and track enquiries. This area is **coming soon** — the full toolset isn't available yet.

## Key tasks

1. **Check back for listings tools.** Listing management and enquiry tracking will appear here as the feature ships.
2. **In the meantime, work from inventory.** Use [Properties](/properties) to see and filter vacant units and export them for advertising.
3. **Capture demand via forms.** Share a [booking form](/settings/booking-forms) so interested applicants land directly in [Bookings](/bookings).

## Tips

- Vacancy data shown here will be driven by unit statuses in [Properties](/properties), so keep those current.
- Until Marketing launches, the [Property Shares](/shares) feature is the quickest way to expose live inventory to external partners.`,
};
