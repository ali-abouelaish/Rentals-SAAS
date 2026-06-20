import type { HelpArticle } from "../domain/types";

export const formsArticle: HelpArticle = {
  slug: "forms",
  title: "Forms",
  route: "/forms",
  match: "exact",
  summary: "Build and send customisable forms to collect responses from clients and tenants.",
  content: `## What this page is for

Forms is your form management hub. It lists every form you have built with its active/inactive status, and is where you create, manage, and navigate to individual forms.

## Key tasks

1. **Create a form.** Click **New form**, give it a name and optional description, then confirm. You'll land directly in the form builder.
2. **Open the builder.** Click **Builder** on any form card to add or edit questions.
3. **View responses.** Click **Responses** on any form card to see submissions.
4. **Activate / deactivate.** Toggle the switch on a form card to control whether the public link accepts new submissions.
5. **Delete a form.** Click the red trash icon on a form card. This permanently removes the form and all its responses.

## Tips

- Each form gets a unique public link (shown as \`/f/<slug>\`) that you can share directly or send via the builder's **Send** action.
- Inactive forms show an "Inactive" badge and stop accepting new responses — useful for closing a form without deleting it.
- Use clear, descriptive names (e.g. "Reference Check", "Tenant Onboarding") so forms are easy to identify in the list.`,
};
