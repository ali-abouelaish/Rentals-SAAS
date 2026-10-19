import type { HelpArticle } from "../domain/types";

export const contractTemplatesArticle: HelpArticle = {
  slug: "contract-templates",
  title: "Contract Templates",
  route: "/contracts/templates",
  match: "prefix",
  summary: "Upload contract PDFs and mark fields that auto-fill from bookings.",
  content: `## What this page is for

Contract Templates let you upload your tenancy agreement PDFs once, mark the dynamic fields on them, and then have booking/tenant data stamped into them automatically — so you don't re-type the same details for every tenancy.

## Key tasks

1. **Review your templates.** The list shows your templates, including inactive ones, and which portfolio each belongs to.
2. **Add a template.** Use **New template** and upload your tenancy contract PDF.
3. **Mark the dynamic fields.** On the editor, visually place the fields that should be filled in per tenancy (tenant name, rent, dates, etc.) — with AI assistance to speed up detection.
4. **Activate it.** Make a template active so it's available when generating contracts.

## Generating a contract

- From an approved booking, choose **Create contract from template** (or pick a template while converting the booking). Confirm the start date, optional end date, rent and deposit — these are pre-filled from the tenancy or the agreed offer — and fill in any template-specific fields.
- After generating, any problems are listed: fields left blank because the data is missing, values cut short to fit their box, or characters the contract font can't print. Check the PDF before sending it.
- **Regenerate from template** (contract → Document tab) re-stamps a draft or sent contract using its current terms and the template answers it was generated with — nothing has to be re-typed.
- A contract that is out for e-signature, e-signed, active with its PDF, or on notice can't be regenerated, so the agreement a tenant signed is never silently replaced. Create a new contract if the terms change.

## Tips

- Bind rent, deposit and tenancy dates to **Contract terms**, not to the unit's listing prices — the contract terms are what the agent confirms at generation, so the PDF always matches the contract record.
- Fields that share a manual key are asked for once and print the same value (e.g. the tenant's name on every page). Give a field its own key if it should be filled in separately.
- Names and addresses in other alphabets' Latin forms (e.g. Polish, Romanian, Turkish) print normally; scripts such as Chinese or Arabic can't be printed yet and are flagged after generation.
- Contract documents are private: links open through Harbor Ops for signed-in admins only, so they can't be forwarded or opened by anyone outside your agency.
- A template that has been used for contracts can't be deleted — untick **Active** to retire it instead.
- Marked fields are auto-stamped from booking and tenant data, keeping generated contracts consistent.
- **Signature fields.** In the field panel, set **Field type** to *Signature*, *Initials*, or *Date signed* to place an e-signature box instead of a merge field. Choose **Who signs this** — Tenant or Landlord — and each party gets their own signing link showing only their own boxes. These boxes stay blank on the generated PDF; they are filled in when the contract is sent for signature from the contract's Document tab. Boxes are placed where they were when the PDF was generated, so later template edits don't move them on contracts already generated.
- **After signing.** The contract's document becomes the executed copy, and the Document tab offers **Signed copy** and **Audit trail** downloads.
- Templates can be scoped per portfolio.
- This feature requires the **Contract Templates** entitlement; it connects to [Contracts](/contracts) and the data captured in [Bookings](/bookings).`,
};
