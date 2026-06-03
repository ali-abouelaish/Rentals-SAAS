import type { HelpArticle } from "../domain/types";

export const bookingsArticle: HelpArticle = {
  slug: "bookings",
  title: "Bookings",
  route: "/bookings",
  match: "prefix",
  summary: "Triage rental applications and convert approved ones into tenancies.",
  content: `## What this page is for

Bookings is the pipeline for rental applications submitted through your public booking forms. You review each application, move it through the pipeline, and convert successful ones into a tenant and contract.

## Key tasks

1. **Share a form.** Use **Share form** to copy or open the public application link (\`/apply/{slug}\`) for any active form, or **Manage** to jump to [Booking Forms](/settings/booking-forms).
2. **Switch views and filter.** Toggle **List** / **Kanban** and filter by search, portfolio, status, or submission date.
3. **Open an application.** Click a row to open the drawer. The **Overview** tab shows applicant details and lets you save internal notes; **Form Responses** shows their answers and any uploaded files; **Actions** holds status changes.
4. **Move it along.** From Actions you can **Mark as Under Review**, or **Reject** with a required reason.
5. **Convert to tenancy.** Use **Convert to tenancy** and answer whether the tenant has signed and paid the holding deposit:
   - **Yes** — the contract becomes **active** and the room is marked **occupied**.
   - **Not yet** — the contract is kept as a **draft** and the room is held as **booked** until you activate it later.

## Tips

- Forms are built and activated under [Booking Forms](/settings/booking-forms); only active forms appear in **Share form**.
- Converting creates records you'll then manage in [Contracts](/contracts) and [Tenants](/tenants).
- Approved and rejected applications are terminal — the Actions tab shows the outcome instead of buttons.`,
};
