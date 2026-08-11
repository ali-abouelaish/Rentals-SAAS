import type { HelpArticle } from "../domain/types";

export const certificatesArticle: HelpArticle = {
  slug: "certificates",
  title: "Compliance",
  route: "/compliance",
  match: "prefix",
  summary:
    "Track statutory certificates per property — red for expired, amber for expiring within 30 days, green for valid.",
  content: `## What this page is for

Compliance tracks every statutory certificate across your portfolio — Gas Safety (CP12), EICR, EPC, fire alarm, emergency lighting, legionella risk assessments, PAT and HMO licences — and shows at a glance where you're exposed.

## Reading the dashboard

1. **The three tiles** count certificates by status: **red** = expired (out of compliance today), **amber** = expires within 30 days, **green** = valid.
2. **Needs attention** lists every expired or expiring certificate, soonest first, with the contractor who issued it. Click the property name to open its Certificates tab.
3. **By property** is the compliance matrix — one row per property, one column per certificate type. Each cell shows the expiry date of the newest certificate of that type, coloured by status. A dash means nothing is on record for that type.

## Key tasks

1. **Add a certificate.** Use **Add certificate** here (choose the property), or open a property's **Certificates** tab — there you can also attach it to a specific room and upload the document (PDF or image, up to 20 MB).
2. **Record the contractor.** Pick the issuing contractor from your maintenance suppliers directory. This is who renewal chase emails go to.
3. **Renew a certificate.** Add the new certificate when it arrives — the dashboard always uses the newest expiry date per type, so the old row simply becomes history.
4. **Download a document.** Use the download icon on the certificate row; files are stored privately and served via a short-lived link.

## Expiry alerts

Alerts run through [Automations](/automations). Four ready-made presets cover the usual setup:

- **Certificate expiry — 30 days (internal)** — an internal reminder for your team.
- **Certificate renewal chase — 30 days** and **— 7 days** — email the issuing contractor asking them to book the renewal.
- **Certificate expired (internal)** — an alert on the day a certificate lapses.

Enable an internal preset *and* a contractor preset to cover both sides. Presets start switched off — dry-run them first, then set them live. Certificates without a contractor on file skip the chase email (the internal reminder still fires).

## Tips

- Status is always calculated from the expiry date, so the colours can never go stale.
- Room-level certificates (e.g. a PAT test for one room) attach to the unit from the property's Certificates tab; everything else covers the whole property.`,
};
