import type { HelpArticle } from "../domain/types";

export const teamArticle: HelpArticle = {
  slug: "team",
  title: "Team",
  route: "/settings/team",
  match: "prefix",
  summary: "Invite colleagues, manage who can sign in, and deactivate accounts.",
  content: `## What this page is for

**Settings → Team** is where you add and manage the staff accounts for your agency. Every person listed here can sign in to this account.

## Key tasks

1. **Invite a user.** Click **Invite user**, enter their name and email, and send. They receive an email to set their own password — you never see or type their password.
2. **Check invite status.** A member shows **Invite pending** until they accept and sign in for the first time; then they become **Active**. Use **Resend invite** if the email was lost.
3. **Deactivate / re-activate.** Deactivating signs the person out and blocks them from signing in again. Re-activate to restore access. You can't deactivate your own account.

## Roles

New members join as **Admin**. Admin is currently required to reach the property-management tools (Properties, Tenants, Bookings, Contracts, Maintenance and the rest), so it is the only role offered for now.

## Tips

- The email address must not already have an account. If it does, ask that person to sign in or reset their password instead.
- Deactivating keeps the person's history and records intact — it only removes their ability to sign in.`
};
