import type { HelpArticle } from "../domain/types";

export const settingsESigningArticle: HelpArticle = {
  slug: "settings-e-signing",
  title: "E-signing settings",
  route: "/settings/e-signing",
  match: "prefix",
  summary:
    "Check that e-signing is connected, see what recipients see on a document, and review what you've sent.",
  content: `## What this page is for

E-signing settings shows the health of your electronic signature setup and what your tenants, landlords and contractors see when a document arrives. Most of it is managed by us — this page reports the state rather than asking you to configure it.

## Envelopes

One **envelope** is used each time you send a document for signature — however many people have to sign it. A tenancy agreement going to a tenant and a landlord is one envelope, not two.

Your e-signing subscription includes **20 envelopes a month**. They reset on the 1st and don't carry over. Run low and you can buy top-up packs, which **never expire** and are only used once the included ones are gone — so you never lose a free envelope by having bought some.

### Buying more

Press **Buy envelopes** and pick a pack. Nothing is charged at that moment and you don't need a card: the cost goes on your agency's next monthly invoice, exactly like an integration. The envelopes are usable immediately.

Only agency admins can buy, because it commits the agency to a charge.

### Running out

You can't send a document with no envelopes left. Rather than a dead end, the **Send for signature** button becomes **Buy envelopes to send** — buy a pack and the document you were trying to send goes out straight away, without you having to find your way back to it.

The signing panel warns you from five remaining, so this shouldn't come as a surprise. If it's likely to be tight — a busy month end, say — top up in advance.

**A send that fails doesn't cost you an envelope.** If the provider rejects it, or a signer's email address is wrong, the envelope goes straight back to the pool it came from.

## Connection

Three things have to be true for e-signing to work end to end:

- **Signing provider — Connected.** Documents can be sent.
- **Mode — Live or Sandbox.** Sandbox is test mode: documents are marked as samples and signatures are **not legally binding**. Anything you send in sandbox is for checking the flow, not for a real tenancy.
- **Completion updates — Receiving.** This is the one worth watching. Without it, documents still send and people can still sign them, but nothing comes back: contracts won't move to **Signed** by themselves and the signed copy and audit trail won't be filed. If this says *Not connected*, tell us — you can't fix it from here.

## Sending identity

Two separate things, and you can have either, both, or neither.

### Branding

Your logo, colour and agency name on the signing page and the email that carries it. Press **Apply my branding** and it's taken from the branding already on your account — there's nothing new to fill in.

A logo is required: the signing provider won't create a brand without one. If your account has no logo the button is disabled and the page says so.

If you later change your logo, name or colour in Harbor Ops, this page will show **Branding out of date** — documents keep going out with the old version until you press **Update branding**. It doesn't re-apply by itself, so nothing changes on a live document without you asking.

### Send from your own address

Optional, and separate from branding. By default signing requests come from our mailbox; turn this on and they come from yours, so tenant replies reach you instead of us.

It needs verifying first. Enter the address and we'll ask the signing provider to email it a verification link — someone with access to that mailbox has to open it. Until they do, the page shows **Awaiting verification** and documents keep sending exactly as they do now. Nothing breaks while you wait.

- **Check again** asks the provider whether it's been verified yet. Verification happens entirely in an email, so nothing tells us automatically — that's why the button exists.
- **Resend email** sends the verification link again if it was lost.
- **Remove** stops using your address. Documents go back to the default one; nothing already sent is affected.

If the address shows **Declined**, the provider won't send from it. Request it again if that was a mistake, or use a different mailbox.

## Document defaults

**Signing order** on a tenancy is fixed: the tenant signs first, then the landlord countersigns what the tenant has already signed. That's deliberate — countersigning a half-executed document isn't meaningful.

**Expiry and reminders** aren't configurable yet; requests use the provider's defaults. If that timing doesn't suit your agency, let us know.

## Activity

A count of what your agency has sent, and how much of it completed. **Failed** means the send itself didn't go through — usually a missing email address on the signer. Open the record and the panel there will say exactly what to fix.

## Tips

- E-signing is a paid integration. If this page redirects you to Integrations, it isn't activated on your account.
- The **Send for signature** button lives on the record, not here: a contract's **Document** tab once it's been generated from a template, and a works order once a contractor with an email address is assigned.
- Signature boxes are placed on your own templates in [Contract Templates](/contracts/templates) — a signature is just another field kind on the canvas, and each one needs a signer role or it means nothing.`,
};
