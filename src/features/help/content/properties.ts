import type { HelpArticle } from "../domain/types";

export const propertiesArticle: HelpArticle = {
  slug: "properties",
  title: "Properties",
  route: "/properties",
  match: "prefix",
  summary: "Manage your property portfolio, room inventory, and vacancy tracking.",
  content: `## What this page is for

Properties is your portfolio's inventory. It lists every property and the individual units/rooms within them, with their status (available, booked, occupied), pricing, and the resident currently in place. It's where you track vacancy and keep unit details up to date.

## Key tasks

1. **Switch views.** Toggle between **List** and **Kanban** in the filter bar. List groups units under their property; Kanban arranges units by status so you can drag to update.
2. **Filter and search.** Narrow by search term, portfolio, area, unit/room type, status, availability dates, and price range.
3. **Add a property.** Click **Add property** to open the [new property form](/properties/new).
4. **Manage portfolios.** Use **Manage portfolios** to create or delete the portfolios you group properties under (each gets a colour).
5. **Open a unit.** Click any unit to open its drawer, where you can edit its details, change its status, assign a tenant, and record or undo a rent payment for a period.
6. **Open a property.** From a property you can run its **setup** (add rooms/units), **edit** its details, and register **keys** and check them out or in.

## Tips

- A unit must be set to *occupied* with a resident before it contributes to [Rent Collection](/rent-collection).
- Converting an application in [Bookings](/bookings) can mark a room as booked or occupied automatically.
- Active tenancies and notices are managed under [Contracts](/contracts).`,
};
