# Harbor Ops — End-to-End Browser Test Plan

A full lifecycle test executed through the browser, in dependency order:
**portfolio → landlord → property → rooms → booking form → bank details → public application (holding deposit) → booking review → convert to tenancy (contract) → contract PDF → tenant → rent collection → deposit → maintenance → profitability → notice & closeout → cleanup.**

Work through phases in order — later phases depend on records created earlier.
Tick each `- [ ]` as you go. Log every failure in the **Bug Log** section at the bottom
(page URL, step number, what you did, what you expected, what happened, screenshot).

---

## Prerequisites (fill in before starting)

| Item | Value |
|---|---|
| App URL (tenant subdomain) | **Use `http://localhost:3000`** — the deployed test subdomain runs an older commit and is missing uncommitted features (spreadsheet view, status picker, etc.). Environment differences vs. localhost are deploy lag, not bugs. |
| Login email | _(agency admin user)_ |
| Login password | _(…)_ |
| Second browser context | Needed for public pages (`/apply/...`, `/f/...`) — use incognito, **not** logged in |

The tenant must have entitlements enabled for: Properties, Bookings, Forms, Contracts, Tenants, Rent Collection, Deposits, Maintenance, Profitability (super admin → tenant → Features if anything is missing from the sidebar).

## Standard test data (use these values everywhere so records are easy to find and delete)

| Entity | Value |
|---|---|
| Prefix for all names | `E2E-` |
| Portfolio | `E2E-Portfolio`, colour: any |
| Landlord (owner) | `E2E-Owner Larry`, `larry.e2e@example.com`, `+447700900001` |
| Property manager | `E2E-Manager Mia`, `E2E-Mgmt Ltd`, `mia.e2e@example.com` |
| Property | `E2E-Test House`, `12 Test Street`, `Flat B`, postcode `E1 6AN`, area `Whitechapel`, tube `Aldgate East` |
| Room 1 | Room number `1`, double, £950–£1000 pcm, deposit £1000, holding deposit £230 |
| Room 2 | Room number `2`, ensuite, £1100–£1200 pcm, couples allowed £1300 |
| Applicant (happy path) | `E2E-Applicant Anna`, `anna.e2e@example.com`, `+447700900002` |
| Applicant (rejection path) | `E2E-Applicant Bob`, `bob.e2e@example.com`, `+447700900003` |
| Agreed rent for booking | `£1000` → expected holding deposit **£231** (1 week = rent ÷ 4.333, rounded) |
| Contract | Start = today, expiry = today + 12 months, rent £1000, deposit £1000 |
| Maintenance job | `E2E-Leaking tap in Room 1`, plumbing, high priority |

## Cross-cutting checks — apply on EVERY form you touch

These are product-wide UI rules; report any page that violates them:

- [ ] Every input has a visible `<label>` **above** it (not placeholder-only).
- [ ] Every input shows a **hint** (format/constraint text) visible before interaction, distinct from error text.
- [ ] Submitting with invalid/empty required fields shows an **inline error directly below the field** (not just a toast).
- [ ] Non-obvious buttons/fields have a **tooltip** on hover explaining why/when.
- [ ] Delete buttons are **red with a trash icon**.
- [ ] Pages show sensible **loading, error, and empty states** (check empty states before creating data where possible).

---

## Phase 0 — Login & shell

1. - [ ] Go to app URL → redirected to login. Log in with test credentials.
2. - [ ] Dashboard (`/dashboard`) loads without errors; widgets render (note any that error or show forever-spinners).
3. - [ ] Side nav renders; note which items are visible (screenshot for reference).
4. - [ ] Global search (top bar): type `zzz-nonexistent` → empty state, no crash.
5. - [ ] Help/assistant chatbot opens and answers a trivial question (e.g. "how do I add a property?").

## Phase 1 — Portfolio & landlord (prerequisites for everything else)

6. - [ ] Go to **Properties** (`/properties`). Note the empty/initial state.
7. - [ ] Create portfolio `E2E-Portfolio` (Create Portfolio dialog): try submitting with an empty name first → inline "Name is required". Then fill name + colour and save → appears in the portfolio filter/list.
8. - [ ] ⚠️ **Two separate landlord systems exist.** The sidebar **Landlords** page (`/landlords`, table `landlords`) is the agency CRM and is **not** what the property form's "Owner landlord" dropdown reads — that dropdown reads a different table (`owner_landlords`) whose records are created via the **New landlord** button *inside the property form's Ownership section* (done in Phase 2, step 12). Records created at `/landlords/new` will never appear in the dropdown; that is by design, not a bug.
9. - [ ] Still smoke-test the CRM: create `E2E-CRM Landlord` at `/landlords/new`. Known issues already logged: placeholder-only labels (no visible `<label>` above inputs) and native browser validation tooltips instead of inline errors — confirm and move on.
10. - [ ] Landlord detail page (`/landlords/[id]`) shows the saved values correctly.

## Phase 2 — Create property (fill every field)

11. - [ ] Go to `/properties/new`. Submit empty → inline errors on Name, Address, Postcode at minimum.
12. - [ ] Fill **all** fields:
    - Portfolio: `E2E-Portfolio`
    - Property type: `HMO`
    - Name `E2E-Test House`, Address line 1 `12 Test Street`, line 2 `Flat B`, postcode `E1 6AN`, area `Whitechapel`, nearest tube `Aldgate East`
    - Total rooms `2`, total bathrooms `1`
    - Bills: `All included`, bills notes `E2E gas cap £40/mo`
    - Toggle every amenity ON then some OFF so the final state is: furnished ✓, parking ✗, garden ✓, broadband ✓, washing machine ✓, dishwasher ✗, central heating ✓, separate WC ✗, smoker OK ✗, pets OK ✓
    - Preferred occupation `Professional`, preferred gender `Any`, min age `21`, max age `45`
    - Floor plan URL: **skip — known gap.** The schema has `floor_plan_url` but the form exposes no input for it (it only displays on the Overview tab). Already logged.
    - Owner landlord: in the Ownership section, on the right side of the "Owner landlord" **label row**, there is a small brand-coloured text link — a tiny **+ New** (plus icon, text size ~11px, easy to miss; it is *not* a full-size button). Click it and create `E2E-Owner Larry` in the dialog (phone, email, contract start today, expiry +24 months, monthly rent owed `2000`, schedule `monthly`, 60-day and 30-day alerts ON — the contract fields live in this dialog, not at `/landlords/new`). After creating, he appears in the dropdown immediately — select him.
13. - [ ] Save → redirected to property setup/detail. Property visible at `/properties` under `E2E-Portfolio`.
14. - [ ] Open **Edit** (`/properties/[id]/edit`) → all values persisted exactly as entered. Change area to `Whitechapel E1`, save, confirm it stuck.
15. - [ ] Attach the **property manager** the same way: use the **New** button next to the "Property manager" dropdown in the Ownership section to create `E2E-Manager Mia` with company, phone, email, notes — verify inline validation on email, then select her.

## Phase 3 — Rooms/units

16. - [ ] From the property setup page (`/properties/[id]/setup`) add **Room 1** — the quick-setup form only exposes room number, available-from date, room type, and min/max price: number `1`, room type `double`, available today, min £950 / max £1000 pcm.
17. - [ ] Add **Room 2**: number `2`, `ensuite`, min £1100 / max £1200.
18. - [ ] Negative test: try min/max price of `0` or `-50` → inline validation error, not saved.
18a. - [ ] The remaining unit fields live in the **Unit Drawer** (open each room from `/properties`): set Room 1's deposit `1000`, holding deposit `230`, couples not allowed, furnishings `furnished`; set Room 2's deposit `1200`, couples allowed ✓ with couples price `1300`. Save and reopen to confirm persistence.
19. - [ ] Go to `/properties` units view. Test **all three view modes** using the icon toggle group (top right of the filter bar): List, Kanban, and **Sheet — the third icon button (table icon, tooltip "Spreadsheet view")**. Both rooms appear in each with correct prices/statuses.
20. - [ ] Filters: filter by portfolio `E2E-Portfolio`, by status `available`, and search `E2E` — rooms found; clear filters.
21. - [ ] **Status control** (recently rebuilt — test carefully): open Room 2's status control, change `available` → `on_hold` with a hold reason. Verify the status badge updates in all three views without a refresh. Then set it back to `available`.
22. - [ ] Kanban: drag Room 2's card between status columns (if drag is supported) → status persists after page reload.
23. - [ ] Open Room 1's **Unit Drawer**: check all sections render (details, status, resident, booking link). Edit deposit to `1000`, save, reopen to confirm.
24. - [ ] Property **Photos tab**: upload one image; it renders; delete it (delete control should be red trash).
25. - [ ] Property **Marketing tab** and **Overview tab**: load without errors; overview shows holding deposit/prices consistent with the rooms.

## Phase 4 — Booking form + bank details (required for the holding-deposit step)

26. - [ ] Go to **Settings → Booking forms** (`/settings/booking-forms`). Create a booking form for portfolio `E2E-Portfolio`, name `E2E-Application Form`, description `E2E test form`.
27. - [ ] Add one question of **each type** the builder offers, e.g.:
    - Text: `Current employer` (required)
    - Textarea: `Tell us about yourself` (optional)
    - Select: `Employment status` with options `Employed / Self-employed / Student` (required)
    - Checkbox: `Do you smoke?`
    - Date: `Preferred move-in date` (required)
    - File upload (if offered): `Proof of ID`
28. - [ ] Reorder questions (drag or up/down) and confirm the order persists after reload. Edit a question's text and toggle required — persists.
29. - [ ] Delete one throwaway question — red trash button, confirm dialog behaves, question gone.
30. - [ ] Go to **Settings → Bank details** (`/settings/bank-details`) and add bank details for `E2E-Portfolio`: fill account label, holder name `E2E Lettings Ltd`, bank name, and reference hint yourself, then **hand off to Ali to type the sort code `12-34-56` and account number `12345678`** (agent financial-data restriction — do not type these fields yourself). Resume after Ali saves. (Without this row the public form hides the "where to pay your holding deposit" panel that steps 32/35 assert.)
31. - [ ] Back on Room 1's drawer/card, click **Copy booking link**. In the dialog: enter rent below the minimum (e.g. `900`) **and click "Copy link"** → inline error "Must be at least £950" and nothing copied (validation runs on submit, not while typing — the enabled button and live deposit preview are expected). Enter `1000` → the dialog previews **Holding deposit (1 week) = £231**. Copy the link.

## Phase 5 — Public application with holding deposit (incognito, logged OUT)

32. - [ ] Open the copied link (`/apply/<form-slug>/<unitId>?price=1000`) in an incognito window. Page loads with agency branding, room summary (`Room 1 · Double`, `E2E-Test House`), rent `£1,000`, **holding deposit £231**, and a "Where to pay your holding deposit" panel showing the `E2E Lettings Ltd` bank details.
33. - [ ] Try to submit empty → required questions and applicant name/email/phone show errors; form does not submit.
34. - [ ] Fill applicant details (`E2E-Applicant Anna`, `anna.e2e@example.com`, `+447700900002`) and **every** question (select an option, tick the checkbox, pick a date, upload a small file if there's a file question). Submit.
35. - [ ] Success screen appears, mentioning the holding-deposit transfer of £231 to the account shown.
36. - [ ] Submit a **second** application on the same link as `E2E-Applicant Bob` (this one will be rejected later).
37. - [ ] Negative: change the unit id in the URL to garbage → graceful error page, not a crash/stack trace.

## Phase 6 — Booking review

38. - [ ] Back in the app, go to **Bookings** (`/bookings`). Both applications appear as **Pending**, each with a random booking reference. Test Kanban and List views.
39. - [ ] Open Anna's booking drawer: applicant details, agreed price £1000, and **all form answers** (including the file, if uploaded) are present and match what was submitted.
40. - [ ] Move Anna's booking to **Under Review**, then **Approve** it.
41. - [ ] Open Bob's booking → **Reject** with reason `E2E duplicate application`. Status becomes Rejected and the reason is stored/visible.
42. - [ ] Filters: by status, by portfolio, by date range, and search `Anna` — all work.

## Phase 7 — Contract template, convert to tenancy, PDF

43. - [ ] Go to **Contracts → Templates** (`/contracts/templates`), create/upload a template (`/contracts/templates/new`): name `E2E-AST Template`, portfolio `E2E-Portfolio`, upload a small PDF. Open the template editor and map at least: tenant name, rent, deposit, start date + one **manual field** (e.g. `Guarantor name`) with a default value.
44. - [ ] On Anna's **approved** booking, run **Convert to tenancy**. ⚠️ The rent/deposit/date fields only appear once a template is selected; with "Generate later" the action creates an **active £0/£0 contract** (known high-severity bug — defaults are computed but ignored in `approveBooking`). Blank expiry = rolling tenancy is **by design**, not a bug. With a template: pick `E2E-AST Template`, start date today, expiry +12 months, rent `1000`, deposit `1000`, fill the manual field (`E2E-Guarantor Gary`). Negative first: clear rent and submit → inline error.
45. - [ ] Convert → success. Verify the chain of effects:
    - [ ] A **tenant** record exists at `/tenants` (`E2E-Applicant Anna`).
    - [ ] A **contract** exists at `/contracts` linked to Room 1 with the right rent/deposit/dates.
    - [ ] Room 1's status changed (booked/occupied) on `/properties`.
46. - [ ] Open the **Contract Drawer** from `/contracts`: all fields correct; expiry-before-start validation works if you try editing dates backwards ("Expiry must be on or after start date").
47. - [ ] **Generate the contract PDF** from the template. Download/open it: mapped values (Anna, £1000, dates) and the manual field value appear in the document.
48. - [ ] Check the pro-rata field: set a mid-month start and confirm the suggested pro-rata amount is plausible (rent × remaining days ÷ days in month).

## Phase 8 — Tenant record & reminders

49. - [ ] `/tenants` → open Anna's **Tenant Drawer**: contact details, unit link, contract link, right-to-rent status control all render. Set right-to-rent status and verify the badge.
50. - [ ] `/tenants/[id]/reminders`: page loads; configure/toggle a rent reminder and save.

## Phase 9 — Rent collection

51. - [ ] `/rent-collection`: Anna's tenancy appears with expected rent £1000 and collection date. Record/mark a payment as paid (and an adjustment if the UI offers one) — totals update.
52. - [ ] `/rent-collection/statements`: generate/open a statement for the property or landlord; open its detail page; if there's a PDF/download, verify it opens.

## Phase 10 — Deposits

53. - [ ] `/deposits`: the £1000 deposit from Anna's contract is listed as **unprotected**.
54. - [ ] `/settings/deposits`: page loads; credential forms render with proper labels/hints.
55. - [ ] Open the **protect** flow (TDS/mydeposits wizard) and walk forward through its steps. ⚠️ Actual protection requires sandbox credentials — if creds aren't configured, verify the wizard fails **gracefully** with a clear message, then stop; do not treat that as a bug unless the error is a crash.
56. - [ ] In the Contract Drawer, set deposit scheme manually (e.g. `TDS`, ref `E2E-REF-123`, protected date today) and verify the deposit badge/status updates on `/deposits` and in the drawer.

## Phase 11 — Maintenance

57. - [ ] `/maintenance`: note empty/initial state. Click **Raise job**: submit empty → inline errors (property + title required).
58. - [ ] Create the job with **every** field: property `E2E-Test House`, unit Room 1, title `E2E-Leaking tap in Room 1`, description `Cold tap drips constantly, tenant reports worsening`, category `Plumbing`, priority `High`, reported by `E2E-Applicant Anna`, assigned to `E2E-Manager Mia`, scheduled date tomorrow.
59. - [ ] Job appears on the Kanban board in **Open** with a high-priority marker. Drag it to **In Progress** → persists after reload.
60. - [ ] Open the **Job Drawer** and add a **cost**: description `Replacement tap + labour`, amount `£85.50`, date today, supplier `E2E-Plumbers Ltd`, invoice ref `INV-E2E-001`. Total cost on the job updates.
61. - [ ] Add a **photo** with a caption; it renders in the drawer. Delete it (red trash).
62. - [ ] Move the job to **Resolved** — resolved date is set. Then **Closed**. Summary tiles at the top (open/in-progress/critical/resolved this month/cost this month) reflect all of this.
63. - [ ] Raise a second quick job with priority `Critical` and leave it Open (feeds the dashboard/profitability checks).

## Phase 12 — Profitability & finances

64. - [ ] `/profitability` → open `E2E-Test House`. Rental income from Anna's tenancy appears, and the **£85.50 maintenance cost** has synced through as a property cost.
65. - [ ] `/finances`: overview loads; add one overhead under `/finances/overheads` (e.g. `E2E-Insurance £30/mo`) and one tenant charge under `/finances/tenant-charges` — both validate and save.
66. - [ ] `/dashboard`: revisit — occupancy/booking/maintenance widgets now reflect the E2E data (1 occupied room, 1 open critical job, etc.).

## Phase 13 — Tenancy lifecycle end

67. - [ ] On Anna's contract: **Give notice** — notice by `tenant`, notice date today, vacate date +30 days. Contract status becomes notice-given; Room 1 shows `move_out` (with notice flag) on the units board.
68. - [ ] Run **Closeout**: actual end date, end reason `tenant_notice`, arrears `0`, would re-let `yes`, end notes `E2E closeout`, deposit returned `1000`, returned date today, release notes `E2E full return`. Negative: try deposit returned `1500` (> original £1000) → should be rejected.
69. - [ ] After closeout: contract terminated, Room 1 back to `available`, deposit shows released on `/deposits`, and the tenancy appears in the unit/property **history** panel.

## Phase 14 — Search, help & cross-module checks

70. - [ ] Global search for `E2E-Test House`, `Anna`, and the booking reference — each returns the right result and its link navigates correctly.
71. - [ ] Ask the help chatbot about bookings and maintenance — it should answer with relevant article content.
72. - [ ] Spot-check the **Forms** module (`/forms`, distinct from booking forms): create a small form, send it (tokenised `/f/<slug>` link), fill it in incognito, and confirm the response appears under `/forms/[id]/responses`.
73. - [ ] Optional (if entitled): **Shares** (`/shares/new`) — create a share for `E2E-Portfolio`, open the public share link in incognito, and submit an agent offer → booking appears in `/bookings` with source `share` and the offer price.

## Phase 15 — Cleanup (destructive — do last, only on the test tenant)

74. - [ ] Delete in reverse dependency order, verifying each delete button is red with a trash icon and shows a confirmation:
    maintenance jobs → contract (if deletable post-termination) → tenant → bookings → booking form → bank details → rooms → property → landlord/manager → portfolio → forms/shares/overheads created above.
75. - [ ] Confirm `/properties`, `/bookings`, `/contracts`, `/tenants`, `/maintenance` show empty/initial states again with no orphaned `E2E-` records (global search for `E2E-` returns nothing).

---

## Round 2

Superseded — the full Round 2 plan (regression on the nine post-run-1 fixes, remaining
functional gaps, tenant-isolation probes, closeout + cleanup) now lives in
**`docs/e2e-round2-test-plan.md`**. Still outstanding beyond that plan, to schedule
separately:

- **Integration-dependent:** deposit protection end-to-end (mydeposits sandbox / TDS
  creds), email delivery (`email_outbox` → Resend → webhook), `/api/cron/*` bearer auth.
- **Breadth:** agency-side modules (leads, clients, rentals, invoices, bonuses,
  earnings, agents, inbox, marketing, …) — page-loads + one create flow each;
  responsive/mobile pass; auth flows (invite accept, reset, session expiry); unknown
  subdomain handling. Tooltip audit blocked on a product decision — the repo has no
  tooltip component, so the CLAUDE.md tooltip rule is currently unsatisfiable.

---

## Bug Log

| # | Phase/Step | URL | What I did | Expected | Actual | Severity | Screenshot |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
