import type { HelpArticle } from "../domain/types";

export const automationsArticle: HelpArticle = {
  slug: "automations",
  title: "Automations",
  route: "/automations",
  match: "prefix",
  summary:
    "Set up rules that send reminders automatically — rent due, arrears chasing, expiry dates, works-order chasing — with dry-run previews before anything goes out.",
  content: `## What this page is for

Automations sends messages for you on a schedule you define once: rent reminders before the due date, arrears chasing until payment lands, expiry warnings weeks ahead, or a nudge when a works order sits open too long. Every rule feeds the same queue you see in [Reminders](/reminders).

## Key concepts

1. **Rules.** A rule = a trigger (a date approaching, something happening, or a threshold being crossed) + who to message + which template to use.
2. **Templates.** Editable message texts with placeholders like {{renter_name}} that fill in per recipient. Manage them under **Templates**; each agency gets a starter set.
3. **Modes.** Every rule is **Off**, **Dry run**, or **Live**. Dry run evaluates daily and records what *would* have been sent — to whom, about what — without sending anything. Start every new rule in dry run.

## Key tasks

1. **Start from a preset.** The preset library covers the common cases (rent due, arrears at 3/7/14 days, expiry warnings, tenancy ending, works-order chase). Presets are created switched off so you can review before enabling.
2. **Check the dry run.** Open a rule to see its activity log and the would-send list. Happy? Switch it to Live.
3. **Preview a message.** Pick a real record and see exactly how the template renders for it before going live.
4. **Watch the activity log.** Each rule lists everything it has fired, linked to the queued/sent message.

## Safety nets

- A rule can never fire twice for the same record on the same occasion — duplicates are blocked at the database level.
- Messages only send inside your **send window** (Settings → Messaging), and a **daily send limit** caps the blast radius if a rule matches far more records than expected — you get an alert instead of a flood.
- Everything a rule schedules is visible (and cancellable) under Reminders → Queued before it sends.`,
};
