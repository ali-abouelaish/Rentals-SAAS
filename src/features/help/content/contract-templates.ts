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

## Tips

- Marked fields are auto-stamped from booking and tenant data, keeping generated contracts consistent.
- Templates can be scoped per portfolio.
- This feature requires the **Contract Templates** entitlement; it connects to [Contracts](/contracts) and the data captured in [Bookings](/bookings).`,
};
