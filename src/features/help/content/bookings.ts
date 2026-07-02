import type { HelpArticle } from "../domain/types";

export const bookingsArticle: HelpArticle = {
  slug: "bookings",
  title: "Bookings",
  route: "/bookings",
  match: "prefix",
  summary: "Triage rental applications and convert approved ones into tenancies.",
  content: `## What this page is for

Bookings is the pipeline for rental applications submitted through your public booking forms. Each application gets its own **booking reference** (e.g. \`BK-7F3K2\`) so you can track it end to end — the forms you send, their responses, the status, and the contract. You review each application, move it through the pipeline, and convert successful ones into a tenant and contract.

## Booking reference

- Every booking is assigned a short reference shown on the card, in the list, and at the top of the drawer.
- It is **random** (not a running number), so it never reveals how many bookings you've taken.
- Search by the reference in the filter bar to jump straight to a booking.

## Key tasks

1. **Share a form.** Use **Share form** to copy or open the public application link (\`/apply/{slug}\`) for any active form, or **Manage** to jump to [Booking Forms](/settings/booking-forms).
2. **Switch views and filter.** Toggle **List** / **Kanban** and filter by search (including the reference), portfolio, status, or submission date.
3. **Open an application.** Click a row to open the drawer. **Overview** shows applicant details and internal notes; **Form Responses** shows their application answers and uploaded files; **Sent Forms** lets you send extra [Forms](/forms) and tracks each one; **Actions** holds status changes and contracts. Responses are **grouped by form** — click a form heading to expand or collapse its answers.
4. **Send a form for more info.** On **Sent Forms**, pick an active form and a recipient (defaults to the applicant) and **Send form**. Each send is tracked as **Sent**, then **Completed** once they submit — their answers appear right under the booking.
5. **Move it along.** From Actions you can **Mark as Under Review**, or **Reject** with a required reason.
6. **Convert to tenancy.** Use **Convert to tenancy** and answer whether the tenant has signed and paid the holding deposit:
   - **Yes** — the contract becomes **active** and the room is marked **occupied**.
   - **Not yet** — the contract is kept as a **draft** and the room is held as **booked** until you activate it later.
7. **Generate the contract.** A contract is **not** created when the booking comes in. Once approved, the **Actions** tab shows **Create contract from template** and lists every contract generated for the booking with a **View PDF** link.

## Bookings from share links

External partner agents browsing a [Property Share](/shares) link can send a booking form for an **available** unit and propose an **offer price**. When they do, a booking is created here automatically (status **Pending**) carrying:

- **Agent** — the name and email the partner entered when sending the form (shown on the card and in the drawer's **Agent & offer** section).
- **Offer price** — the monthly rent the agent proposed for the unit.
- **Source: Share link** — marks the booking as agent-originated rather than a direct application.

The applicant is emailed the booking form for that specific unit, pre-set to the agent's offer — so they see the agreed **monthly rent** and the **holding deposit** (about one week's rent). When they submit, their details and answers complete this same booking (no duplicate is created).

## Tips

- The **Sent Forms** tab needs the Forms feature enabled; the forms themselves are built under [Forms](/forms).
- Forms are built and activated under [Booking Forms](/settings/booking-forms); only active forms appear in **Share form**.
- Converting creates records you'll then manage in [Contracts](/contracts) and [Tenants](/tenants).
- Approved and rejected applications are terminal — the Actions tab shows the outcome (and contracts) instead of the review buttons.`,
};
