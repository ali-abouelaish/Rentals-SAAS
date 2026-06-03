import type { HelpArticle } from "../domain/types";

export const propertiesNewArticle: HelpArticle = {
  slug: "properties-new",
  title: "Add a property",
  route: "/properties/new",
  match: "exact",
  summary: "Create a new property and attach its owner, manager, and portfolio.",
  content: `## What this page is for

This form creates a new property record. Once saved, you'll add its rooms/units through the property's setup step.

## Key tasks

1. **Choose a portfolio** (optional). Group the property under one of your existing portfolios. If you don't have one yet, create it from the **Manage portfolios** dialog on the [Properties](/properties) page first.
2. **Assign the owner landlord and property manager.** These are drawn from your landlord records.
3. **Enter the address and area.** Fill in the property's address details and the area it sits in (used for filtering).
4. **Save.** The property is created and you'll continue to its setup to add rooms/units.

## Tips

- Portfolios drive filtering, colour-coding, and per-portfolio settings like bank details — set them up before adding lots of properties.
- After creating the property, use its **setup** step to add units; only then will rooms appear in inventory, bookings, and contracts.`,
};
