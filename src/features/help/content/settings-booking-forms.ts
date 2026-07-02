import type { HelpArticle } from "../domain/types";

export const settingsBookingFormsArticle: HelpArticle = {
  slug: "settings-booking-forms",
  title: "Booking Forms",
  route: "/settings/booking-forms",
  match: "exact",
  summary: "Build the public application forms that feed your Bookings pipeline.",
  content: `## What this page is for

Booking Forms is the form builder for your public rental applications. Each form has its own questions and a public link applicants fill in; their submissions arrive in [Bookings](/bookings).

## Key tasks

1. **Create a form.** Add a new form and give it a name (forms can be scoped per portfolio).
2. **Build the questions.** Add, edit, delete, and reorder questions to capture exactly what you need from applicants.
3. **Import with AI.** Click **Import** on a selected form to paste in the text of an existing form (e.g. from Google Forms). The AI detects each question, its type, and any options; review and adjust them, then import to add them to the form in one step.
4. **Activate it.** Mark a form active so it becomes available to share.
5. **Share the link.** Copy the public \`/apply/{slug}\` link to send to applicants or embed it.

## Tips

- Only **active** forms show up under **Share form** on the [Bookings](/bookings) page.
- Applicant answers (including uploaded files) appear in the booking drawer's **Form Responses** tab.
- Set up per-portfolio [Bank Details](/settings/bank-details) so payment instructions are correct on the forms that use them.`,
};
