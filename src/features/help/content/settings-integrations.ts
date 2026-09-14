import type { HelpArticle } from "../domain/types";

export const settingsIntegrationsArticle: HelpArticle = {
  slug: "settings-integrations",
  title: "Integrations",
  route: "/settings/integrations",
  match: "prefix",
  summary:
    "Turn integrations like e-signing and deposit protection on for your agency, and see what they cost.",
  content: `## What this page is for

Integrations connect Harbor Ops to the outside services your agency uses — e-signing, deposit protection schemes, your own email provider, and more as they arrive. Everything is opt-in: you turn on what you need, when you need it.

## Turning one on

1. Find the integration and press **Activate**.
2. Confirm the monthly price. For paid integrations you tick a box agreeing to the charge.
3. It's on immediately.

**Nothing is charged at the moment you activate, and you don't need to enter a card.** The price is added to your agency's next monthly invoice, and it starts on the 1st of the following month — so the rest of the current month is free.

## The states a card can be in

- **Active** — on and working.
- **Setup needed** — subscribed, but it needs a connection before it does anything. What happens next depends on who does the setup:
  - **You do it.** The card shows **Finish setup**; follow the screen it takes you to. mydeposits and email sending work this way.
  - **We do it.** The card reads *We'll set this up*. TDS and DPS issue API credentials to each agency individually and those have to be applied on our side, so send us your scheme account details and we'll finish it and let you know.
- **Ending** — you've cancelled it. It keeps working until the end of the month, then switches off.
- **Coming soon** — we're building it. It'll become activatable here when it's ready.

## Cancelling

Press **Cancel** on any active integration. You keep access until the end of the month you cancel in — you've already paid for that month — and the charge stops after that. Nothing you've already done is undone: signed documents stay signed, protected deposits stay protected, and the records stay on file.

You can reactivate at any time. Billing restarts from the following month.

## What each integration unlocks

- **E-signing** — the *Send for signature* button on contracts and works orders. Includes 20 envelopes a month (one per document sent); extra packs are bought on the [E-signing settings](/settings/e-signing) page and billed the same way. Without it, that button is replaced by a prompt to activate. It works the moment you turn it on; [E-signing settings](/settings/e-signing) shows the connection status, what recipients see on a document, and everything you've sent.
- **Deposit protection (mydeposits, TDS, DPS)** — the scheme's tab under Deposits, and the ability to protect a deposit from a tenancy.
- **Send from your own mailbox** — included in your plan at no extra cost. Connects Microsoft 365, Gmail or SMTP so emails come from your agency's address instead of the shared Harbor Ops mailer.

## Tips

- Only agency admins can activate or cancel an integration, because it commits the agency to a charge.
- If a paid feature seems to be missing, check here first — it may simply not be activated.
- Activating a deposit scheme doesn't finish the job. Until you've connected your scheme account, the card reads **Setup needed** and deposits can't be protected.`,
};
