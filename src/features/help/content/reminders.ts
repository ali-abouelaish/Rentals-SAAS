import type { HelpArticle } from "../domain/types";

export const remindersArticle: HelpArticle = {
  slug: "reminders",
  title: "Reminders",
  route: "/reminders",
  match: "prefix",
  summary: "One inbox for internal team reminders and every scheduled outgoing message.",
  content: `## What this page is for

Reminders is the shared inbox for everything the system is due to send or surface — internal to-dos assigned to your team, one-off scheduled emails, and messages queued by automation rules.

## The tabs

1. **Pending** — internal (in-app) reminders that have come due and are waiting for someone to deal with them. Anything older than a day is flagged **Overdue**.
2. **Queued** — messages scheduled but not sent yet. You can still **edit** the text or send time, or **cancel** them.
3. **Sent** — everything delivered, with who it went to and when.
4. **Failed** — messages that could not be delivered, with the reason (e.g. the tenant has no email on file, or has opted out).
5. **Dismissed** — internal reminders that were dismissed or messages that were cancelled.

## Key tasks

1. **Add a reminder.** Use **Add reminder** here, or on a property, tenant, or maintenance work order page (there it's automatically linked to that record). Choose **internal** (appears in this inbox, assigned to a team member) or **email** (goes to the tenant, owner, contractor, or any address).
2. **Deal with a pending reminder.** **Done** acknowledges it, the snooze buttons (1d / 3d / 1w) push it away and it re-surfaces later, and the red bin dismisses it.
3. **Repeat a reminder.** Tick **Repeat** when creating one — every N weeks or months, with an optional end date.
4. **Use placeholders.** In the message body, placeholders like {{renter_name}} or {{property_address}} are filled in from the linked record when the reminder is created.

## Tips

- Emails respect the agency **send window** (Settings → Messaging) — a reminder scheduled for 11pm sends the next morning instead.
- Recipients linked to a record (e.g. "the tenant") are looked up at send time, so a changed email address or an opt-out is always respected.
- Automation rules (see [Automations](/automations)) fill this same queue — everything they schedule shows up under Queued before it sends.`,
};
