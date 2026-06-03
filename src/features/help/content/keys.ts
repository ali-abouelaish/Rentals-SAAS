import type { HelpArticle } from "../domain/types";

export const keysArticle: HelpArticle = {
  slug: "keys",
  title: "Keys",
  route: "/keys",
  match: "prefix",
  summary: "See which physical keys are out and check overdue ones back in.",
  content: `## What this page is for

Keys tracks every physical key that's currently out of the office — who's holding it, since when, and whether it's overdue for return. It's the portfolio-wide view of keys in circulation.

## Key tasks

1. **See what's out.** The dashboard lists every key currently checked out, along with its holder (an internal agent or an external contact) and purpose.
2. **Filter to overdue.** Switch the filter to **Overdue** to focus on keys past their expected return.
3. **Check a key in.** Use **Check in** on a row, confirm, and record the returned condition. The key is logged back into the office.
4. **Register keys and check them out.** Registering new keys and checking them out happens on the individual property's detail page (open a property from [Properties](/properties)).

## Tips

- A key can be held by an internal agent or an external contact (e.g. a contractor).
- Overdue keys are highlighted so nothing gets lost in circulation.
- Each key keeps a full check-out / check-in history on its property record.`,
};
