import type { HelpArticle } from "../domain/types";

export const landlordsArticle: HelpArticle = {
  slug: "landlords",
  title: "Landlords",
  route: "/landlords",
  match: "prefix",
  summary:
    "Maintain landlord partners, contacts, and commission terms — pull their listings from a SpareRoom profile or a spreadsheet, or add them by hand.",
  content: `## What this page is for

Landlords holds your landlord partners — their contacts, listings, and whether they pay commission (and on what terms). It's the partner side of your rental business.

## Key tasks

1. **Add a landlord.** Use **Create landlord** to add a new partner and their details.
2. **Search and filter.** Search by name, contact, or email, and filter by **Paying** / **Not Paying** commission.
3. **Open a landlord.** Click a row to view and edit the landlord's full record and listings.
4. **See commission at a glance.** Each row shows whether they pay commission and the agreed amount or terms.
5. **See where your stock is.** The **Map** above the list plots every landlord's listings.
6. **Check the daily scrape.** The **Daily SpareRoom scraping** card shows how the last run went. Admins can **Scrape all now** or pause the schedule (see below).

## Map

The **Map** on the Landlords page shows where all your landlords' listings are — every landlord, not just the page of the list you're on. It follows the search box and the **Paying** / **Not Paying** filter, so filtering to paying landlords shows only their stock.

- **Budget (£ pcm)** — enter a monthly budget and press **Apply** to hide listings priced above it. Listings with no price are hidden too, since they can't be confirmed as affordable.
- **Double occupancy** — tick it to show only listings marked as accepting couples (SpareRoom's "Couples OK"). Listings that don't say either way are hidden.
- These two filter listings, not landlords, so they change the map but not the landlord list. **Clear** removes them.
- **Tap a pin** for the listing's title, price, when it was last seen, the landlord, and a link to the advert. Several ads at the same address share one slightly larger pin, and its popup lists them all.
- **Zoom** with the **+ / −** buttons, by pinching on a trackpad or phone, or with Ctrl + mouse wheel while over the map. Plain scrolling scrolls the page, not the map, so you can't get stuck in it.

Each landlord's own page has a smaller map of just their listings, above the **Listings** table.

**Why is a listing missing from the map?** It has no location. SpareRoom listings get exact coordinates automatically when scraped. Listings you add by hand are placed from the first full UK postcode in their **Location / address** — no postcode, no pin. Spreadsheet listings only have a location if the sheet has **latitude** and **longitude** columns mapped in **Review columns** — an address or postcode alone isn't enough yet. A note under the map says how many listings couldn't be placed.

## Getting a landlord's listings in

Each landlord can supply listings three ways, and you can mix them:

- **SpareRoom profile URL** — the scraper reads their profile on a daily run. **Run scraper** on the landlord page does it immediately.
- **Listings spreadsheet URL** — for landlords who send a sheet instead. Paste the link and save; that's the whole setup. The sheet is read straight away and re-read daily.
- **By hand** — **Add listing** on the landlord's **Listings** card, for landlords who tell you about rooms by phone or email.

Whichever way, the listings land in the same place — the landlord's **Listings** table, the maps, the [public API](/settings/api-keys), and the matching that runs over inbound enquiry emails.

## Adding listings by hand

Open the landlord and press **Add listing** on the **Listings** card. Only **Title** is required; fill in whatever else you know — rent, deposit, available date, property type, rooms available, bills, furnishings, couples, an advert link, photo links (one per line, up to 20; the first is the main photo) and a description.

- **Put it on the map** by including a full UK postcode in **Location / address** (e.g. "Wilmslow Road, M14 5RT"). We look the postcode up when you save.
- **Couples OK** matters for the map's **Double occupancy** filter, which only shows listings marked Yes.
- **They don't go stale.** Nothing re-checks a listing you typed in, so it never turns red — the **Last confirmed** column shows when it was last updated instead. It stays live everywhere, including the public API, until you delete it. Remember to delete or edit it when the room is let.
- **Edit** is on each hand-added row. **Delete** is admin-only, like deleting a landlord. Enquiries already matched to a deleted listing keep their details but lose the link to it.
- **Scraped and spreadsheet listings can't be edited here** — their next run would overwrite the change. Fix them at the source (the SpareRoom advert or the sheet) instead.

## Daily scraping

The **Daily SpareRoom scraping** card at the top of the Landlords page shows whether the 09:00 (UK time) run is on for your agency, how many landlords it reads, and **how the last run went**:

- **Last run** — when it ran, whether it was the daily run or started by hand, how many landlords were read, how many listings were refreshed, and how many were removed because they're no longer live on SpareRoom.
- **Couldn't be read** — landlords the run couldn't get through. Their listings are kept as they were, so they'll start to age. Each name links to the landlord; usually their SpareRoom link has changed or the profile is blocking us.
- **Had no live adverts** — landlords read cleanly with nothing currently advertised, so their old listings were removed. Worth a look if that's a surprise.
- **Failed** — the whole run didn't complete, with the reason. Existing listings are left as they were.

### Scrape all now

Admins can press **Scrape all now** to scrape every landlord with a SpareRoom profile straight away instead of waiting for 09:00 — handy after adding several landlords, or after fixing profile links. It runs in the background and takes a few minutes per landlord, so you can leave the page; the card shows it in progress and updates itself with the result.

- Only one scrape runs per agency at a time — the button is greyed out while one is going, including the 09:00 run.
- If another scrape is busy on the server, you'll be told to try again in a few minutes.
- To refresh a single landlord, use **Run scraper** on their page instead — it's much quicker.

### Pausing the daily scrape

Admins can **Pause daily scraping** and **Turn on daily scraping** from the same card; it's on unless someone turns it off.

- **Pausing keeps your listings.** Nothing is deleted — they just stop being refreshed, so after a week they turn red as unconfirmed, and listings that came down on SpareRoom stay on your side until you scrape again.
- **Scrape all now** and **Run scraper** still work while paused, if you want to refresh by hand.
- It only affects SpareRoom. Listings spreadsheets are still re-read daily, and listings added by hand are unaffected.
- While paused, each landlord's **Last scraped** shows a note saying so, so a date that's stopped moving isn't mistaken for a broken profile.

## How do I know the listings are still current?

Two things on the landlord page tell you, and it's worth checking before you send anything to an applicant.

- **Last scraped** (in the landlord's details) — when we last read their source end-to-end. If a run can't reach a landlord — profile URL changed, SpareRoom blocking us, the sheet link revoked — we deliberately leave their existing listings alone rather than wiping them, and this date stops moving. **A date drifting into the past is the warning sign**, and it turns red after a week.
- **Last confirmed** (a column on the **Listings** table) — when each individual listing was last confirmed live at its source. Stale ones turn red and a count appears above the table. Listings added by hand show when they were last updated instead, and never count as stale.

Note that the status on everything the scraper writes is "available" — it comes from the advert, not from us, and it doesn't mean we've checked. **Last confirmed** is the column to trust.

If a landlord looks stale, first check the **Daily SpareRoom scraping** card on the Landlords page isn't paused. Then hit **Run scraper** (or **Import now** for a spreadsheet) and see if it recovers. If it doesn't, their profile or sheet link usually needs updating on the landlord record.

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
