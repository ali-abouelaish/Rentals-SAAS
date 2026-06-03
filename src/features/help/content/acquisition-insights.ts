import type { HelpArticle } from "../domain/types";

export const acquisitionInsightsArticle: HelpArticle = {
  slug: "acquisition-insights",
  title: "Acquisition Insights",
  route: "/acquisition-insights",
  match: "prefix",
  summary: "Evaluate potential acquisitions with AI break-even analysis.",
  content: `## What this page is for

Acquisition Insights helps you assess a property you're thinking of taking on. You enter its details and financials and get an AI-assisted evaluation — break-even analysis and recommendations informed by your existing portfolio.

## Key tasks

1. **Review past evaluations.** The list shows every evaluation you've run and its status.
2. **Start a new evaluation.** Create a new evaluation and enter the property's details and numbers; the tool produces break-even figures and AI recommendations.
3. **Open an evaluation.** Click through to read the full analysis and saved recommendations.
4. **Update status.** Move an evaluation through your decision pipeline as you progress it.
5. **Link to a property.** Once acquired, link the evaluation to a property record and capture outcome notes.

## Tips

- Recommendations draw on your current portfolio, so the more accurate your [Properties](/properties) and [Profitability](/profitability) data, the better the guidance.
- Linking a won evaluation to a property keeps the original analysis alongside the live record.`,
};
