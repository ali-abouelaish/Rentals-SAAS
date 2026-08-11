import type { HelpArticle } from "../domain/types";

export const landlordsArticle: HelpArticle = {
  slug: "landlords",
  title: "Landlords",
  route: "/landlords",
  match: "prefix",
  summary:
    "Maintain landlord partners, contacts, and commission terms — and pull their listings from a SpareRoom profile or a spreadsheet.",
  content: `## What this page is for

Landlords holds your landlord partners — their contacts, listings, and whether they pay commission (and on what terms). It's the partner side of your rental business.

## Key tasks

1. **Add a landlord.** Use **Create landlord** to add a new partner and their details.
2. **Search and filter.** Search by name, contact, or email, and filter by **Paying** / **Not Paying** commission.
3. **Open a landlord.** Click a row to view and edit the landlord's full record and listings.
4. **See commission at a glance.** Each row shows whether they pay commission and the agreed amount or terms.

## Getting a landlord's listings in

Each landlord can supply listings two ways, and you can use either or both:

- **SpareRoom profile URL** — the scraper reads their profile on a daily run. **Run scraper** on the landlord page does it immediately.
- **Listings spreadsheet URL** — for landlords who send a sheet instead. Paste the link and save; that's the whole setup. The sheet is read straight away and re-read daily.

Either way the listings land in the same place — the landlord's **Listings** table, the [public API](/settings/api-keys), and the matching that runs over inbound enquiry emails.

## How do I know the listings are still current?

Two things on the landlord page tell you, and it's worth checking before you send anything to an applicant.

- **Last scraped** (in the landlord's details) — when we last read their source end-to-end. If a run can't reach a landlord — profile URL changed, SpareRoom blocking us, the sheet link revoked — we deliberately leave their existing listings alone rather than wiping them, and this date stops moving. **A date drifting into the past is the warning sign**, and it turns red after a week.
- **Scraped** (a column on the **Listings** table) — when each individual listing was last confirmed live at its source. Stale ones turn red and a count appears above the table.

Note that the **Status** column says "available" on everything the scraper writes — it comes from the advert, not from us, and it doesn't mean we've checked. **Scraped** is the column to trust.

If a landlord looks stale, hit **Run scraper** (or **Import now** for a spreadsheet) and see if it recovers. If it doesn't, their profile or sheet link usually needs updating on the landlord record.

## Adding a listings spreadsheet

Edit the landlord, paste the link into **Listings spreadsheet URL**, and save.

- **Google Sheets** — copy the URL from the address bar with the sheet open. It must be shared as **Anyone with the link — Viewer** (Share → General access). If your server has a Google service account configured, you can instead share the sheet with that account and keep it private.
- **A hosted file** — any direct link ending in \`.csv\`, \`.xlsx\` or \`.xls\`.

On save an AI model reads a snapshot of the top of the sheet and works out how to scrape it — which row is the header, what each column contains, and which columns identify a row — then we import the rows and tell you how many landed. (If AI isn't configured on the server it falls back to a name-and-value heuristic.) A **Listings spreadsheet** panel then appears on the landlord page with the read status, an **Import now** button, and **Review columns**.

## Checking the column mapping

**Review columns** shows every column in the sheet, a few real values from it, and the listing field the AI mapped it to. Green means we're confident, amber means look at it, and anything set to *Do not import* is ignored. Saving stores the mapping and re-imports with it — later reads replay exactly that mapping rather than re-asking the model, so the AI never changes a mapping you've confirmed behind your back.

- **Header on the wrong row?** Sheets often open with a title or logo row. Change **Header row** and press **Re-read**.
- **Changing the link to a different sheet** clears the old mapping, since it no longer describes the new columns.

## Row identity — telling rows apart

We need to know that row 14 today is the same listing as row 9 tomorrow, otherwise a re-read imports everything again as new listings.

If the sheet has a reference or ID column, map it to **Reference / ID** and you're done. **Many sheets have no unique column** — but a *combination* is unique. In **Review columns**, the **Row identity** section lets you tick the columns that together identify a row:

- A per-room sheet: tick **Address** + **Room Type**.
- A per-property sheet with one row each: **Address** alone is enough.
- Still not unique? Add a third, up to 5.

Values are compared case-insensitively with spacing collapsed, so tidying \`"12  BIRCHFIELD RD "\` to \`"12 Birchfield Rd"\` in the sheet won't duplicate the listing. Editing anything *outside* the identity columns — rent, availability, description — updates the existing listing, which is the point.

If two rows end up with the same identity, the second is skipped and the read's notes tell you which columns collided, so you know to add another one.

With nothing ticked we fall back, in order, to: the mapped **Reference / ID** column → the listing URL → a fingerprint of title + address + price. That last one is a genuine fallback: change the rent in the sheet and it looks like a new listing.

## Room photos from Google Drive

If the sheet has a column with a link to the property's Drive folder, map it to **Google Drive photo folder** and we'll pull each room's pictures automatically.

We expect the folder laid out the way agencies usually keep it:

\`\`\`
12 Birchfield Road/          ← the link in the spreadsheet
├── Room 1/                  ← matched to the row whose room is "Room 1"
├── Room 2/
├── Loft Room/
├── Kitchen/                 ← communal: goes on every room in the property
├── Communal Areas/
└── frontage.jpg             ← loose images: also treated as property-wide
\`\`\`

Each row gets **its own room's photos first, then the communal ones** — so the main photo on a listing is always that room, not the kitchen.

To match rows to subfolders we use the **Room name / number** column if you map one, otherwise the room type, otherwise the title. Matching is forgiving about wording — \`Room 2\`, \`room 2\`, \`R2\`, \`Rm 2\` and \`Bedroom 2\` all find the *Room 2* folder — but strict about numbers, so *Room 2* will never pick up *Room 3*'s pictures.

Folders named for communal space (*Kitchen*, *Bathroom*, *Lounge*, *Hallway*, *Garden*, *Exterior*, *Communal Areas*, anything "shared" or "common") are recognised automatically and applied to every room.

If a row's room can't be found in the folder it still gets the communal photos, and the read's notes tell you which rooms didn't match and which subfolders were actually there — usually the two names just differ.

### Hyperlinked cells

Watch out for cells that *display* a word but link somewhere — a cell reading **Pictures** that links to the Drive folder, rather than containing the address as text.

Google's CSV export gives us only the visible word, throwing the link away, so those columns import as empty and the read's notes will say so. Two fixes:

1. **Configure a Google service account on the server** (preferred). We then read the sheet through the Sheets API, which preserves hyperlinks, and \`Pictures\` resolves to the folder it points at. This also covers \`=HYPERLINK("…","Pictures")\` formulas.
2. **Put the full \`https://…\` address in the cell as plain text**, instead of hiding it behind a label.

Until one of those is in place we leave the column empty rather than importing the label, because storing "Pictures" as a web address produces broken links.

### Sharing the folder

Set the Drive folder to **Anyone with the link — Viewer**. This matters twice over: it's how we read the folder, and the stored photo URLs point at Drive, so a folder shared only with the service account can be read by the importer but its images won't display to anyone. Photo import also needs a Google service account configured on the server — without one the listings still import, just without pictures, and the notes say so.

## Formats we understand

| Field | Accepted in the sheet |
|---|---|
| Price, deposit, room prices | \`1200\`, \`£1,200\`, \`£1,200 pcm\`, \`£650 - £800\` (takes the lower bound) |
| Available from | \`01/03/2026\` (UK order), \`2026-03-01\`, \`1 March 2026\`, \`now\` / \`ASAP\` |
| Rooms, photo count | Any number; decimals are truncated |
| Everything else | Free text, trimmed |

A cell we can't parse into the field's type is left empty rather than guessed at.

## When a spreadsheet read fails

The panel shows a red **Last read failed** pill with the reason. The common ones:

- *"That Google Sheet is not shared publicly"* — set link sharing to Anyone with the link (Viewer), or share it with the service account.
- *"Column X is mapped but no longer exists"* — a heading was renamed upstream. Open **Review columns** and re-point that field.
- *"No title, address, URL or price"* — the row was blank or a note; those are skipped and listed in the read's notes.

**Remove** detaches the spreadsheet and forgets its mapping. Listings it already imported are kept, since they may be attached to leads.

## Tips

- Commission terms set here flow into [Bonuses](/bonuses) and invoicing.
- Use the paying/not-paying filter to quickly find partners to chase or onboard.`,
};
