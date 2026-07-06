# Harbor Ops — Round 2 Browser Test Plan

**Scope:** (A) regression on the nine fixes applied after run 1, (B) functional gaps run 1 didn't reach (rejection, draft path, double-booking probe, shares, form sends), (C) tenant-isolation probes, (D) Anna's closeout + the full destructive cleanup that run 1 skipped.

Run 1 results: `docs/harbor-ops-e2e-test-report.md`. Original plan: `docs/e2e-browser-test-plan.md`.

Work through phases in order — they are sequenced to reuse the preserved run-1 records and to leave destructive steps last. Log every failure in the **Bug Log** at the bottom (URL, step, expected vs actual, severity, screenshot).

---

## Prerequisites

| Item | Value |
|---|---|
| URL | `http://localhost:3000` **only** (deployed instance lags the working tree) |
| Dev server | ⚠️ The fixes live in the working tree — make sure `npm run dev` has been (re)started since they were applied, or you'll retest the old code |
| Login | Same admin user as run 1 (Ali re-logs in on session expiry — never type credentials yourself) |
| Public pages | Second tab / incognito for `/apply/...`, `/f/...`, share links |
| Financial handoffs | None expected this round (bank details already saved in run 1) |

## Preserved state from run 1 (starting point)

| Record | State |
|---|---|
| Room 1 (Double, E2E-Test House) | **Move Out** — Anna's tenancy, contract **Notice Given** (£1000/£1000, 06/07/2026 → 06/07/2027, collection day 1), available 4 Sept 2026 |
| Room 2 (Ensuite) | **Available**, £1100–1200 pcm, couples £1300, deposit £1200 |
| Booking — Anna | Approved (converted) |
| Booking — Bob | **Pending** (never rejected in run 1 — done in Phase 4) |
| Stray **Draft** contract | Duplicate created by run 1's template generation (OBS-1) — used in Phase 3, then deleted |
| Booking form | E2E-Application Form (6 questions), public slug `d101d8e1e96f` |
| Template | E2E-AST Template (9 fields, Guarantor manual) |
| Bank account | E2E-Portfolio · E2E Lettings Ltd (enables the "where to pay" panel) |
| Maintenance | E2E-Leaking tap in Room 1 — In Progress, £85.50 cost |

## New test data this round

| Entity | Value |
|---|---|
| Applicant (Room 2 happy path) | `E2E-Applicant Cara`, `cara.e2e@example.com`, `+447700900004` |
| Applicant (double-booking probe) | `E2E-Applicant Dan`, `dan.e2e@example.com`, `+447700900005` |
| Agreed rent Room 2 | `£1150` → expected holding deposit **£265** (1 week = rent ÷ 4.333, rounded) |
| CRM landlord | `E2E-CRM Landlord 2` |
| Foreign-tenant IDs for isolation probes (Phase 9) | property `bb100000-0000-4000-8000-000000000003` · unit `bb300002-0000-4000-8000-000000000001` · contract `e1ff404d-49f5-4bbb-bac0-19a029f3b7bf` |

---

## Phase 0 — Sanity

1. - [ ] Log in; confirm the preserved records above are present (`/properties`, `/bookings`, `/contracts`). If the dev server predates the fixes, stop and ask Ali to restart it.

## Phase 1 — Booking-form builder regressions (fixes for BUG-2/3/4)

2. - [ ] Open E2E-Application Form in the builder. Add a **Dropdown** question `Parking needed?` with options `Yes / No / Sometimes` → the saved row immediately reads **"3 options"** (run 1 showed the character count, e.g. "38 options").
3. - [ ] Click **Edit** on that question immediately (no reload) → editor opens with all 3 options listed; **no crash** (run 1 threw `options.map is not a function`). Cancel out.
4. - [ ] Delete that question → a **confirm dialog** appears (run 1 deleted instantly). Cancel → still there. Delete again, confirm → gone.
5. - [ ] Create a new booking form `E2E-Round2 Form` (any portfolio) → it appears in the form list **without a page reload** and is auto-selected (run 1 needed a manual reload). Delete it afterwards (tests form delete too).

## Phase 2 — Landlord form regressions (fixes for BUG-5/7)

6. - [ ] `/landlords/new`: every field now has a **visible label above it** and an always-visible **hint**; submit empty → inline "Name is required" below the field (not a native browser tooltip).
7. - [ ] Enter email `not-an-email` and Spareroom URL `not-a-url` → inline errors under each field. Fix them (`landlord2.e2e@example.com`, leave URL empty), name `E2E-CRM Landlord 2`, save → redirects to the new landlord's page.
8. - [ ] On that landlord's page, open **Edit** → same labelled/hinted form, prefilled; change contact, save → toast + values persist.
9. - [ ] Open E2E-Test House's **edit page** → in the Ownership section, the create controls are now visible **outline buttons** labelled "New landlord" / "New manager" (run 1: tiny "+ New" text links). Dropdown still lists E2E-Owner Larry.

## Phase 3 — Contract edit regression (fix for BUG-6) + stray draft cleanup

10. - [ ] Open the **stray Draft contract** (run 1's duplicate) in the contract drawer → Edit. Clear **Collection day** and leave **Signing method** on "Select…" → **Save succeeds** (run 1: silent block, focus jump).
11. - [ ] Enter collection day `45` → inline "Day must be between 1 and 31" **below the field**. Set it back to blank, save.
12. - [ ] Now **delete the stray Draft contract** (red trash + confirm) — removes the run-1 duplicate. Anna's Notice Given contract must remain untouched.

## Phase 4 — Bob's rejection (gap from run 1)

13. - [ ] `/bookings` → open Bob → **Reject** with reason `E2E duplicate application` → status Rejected, reason stored and visible when reopening. Room 1 unaffected.

## Phase 5 — Room 2 cycle: no-template conversion, draft path, PDF attach (fixes for BUG-1/OBS-1)

14. - [ ] From Room 2, **Copy booking link** with agreed rent `1150` → dialog previews holding deposit **£265**. Copy.
15. - [ ] **Price tampering**: open the copied link but change the query to `?price=1`, then `?price=99999` → the page must fall back to the listed price range (server clamps against min/max), and the holding deposit must reflect the clamped value — never £0/£1-based. Log if the tampered value is honoured.
16. - [ ] Open the genuine link: page shows Room 2 (Ensuite), rent £1,150, holding deposit £265, bank panel, and **couples pricing** if displayed. Submit as **Cara** (all questions).
17. - [ ] `/bookings` → Cara → **Convert to tenancy**. The contract fields (start/expiry/rent/deposit) are **visible immediately with no template selected**, prefilled with rent `1150` (agreed price) and deposit `1200` (unit deposit) — this is the core BUG-1 regression check. Clear rent → inline "Rent is required" on submit.
18. - [ ] Restore rent `1150`, leave template on "Generate later", start today, expiry blank, choose **"Not yet — keep as draft"** → contract created as **Draft with the real terms (not £0/£0)**; Room 2 becomes **`booked`**.
19. - [ ] Open Cara's Draft contract → set status **Active** (add expiry +12 months while editing) → save. Room 2 becomes **`occupied`**.
20. - [ ] From Cara's booking (Actions tab), **generate the contract PDF** from E2E-AST Template (fill the Guarantor manual field `E2E-Guarantor Gina`) → the PDF attaches to Cara's **existing Active contract**; `/contracts` shows **exactly one** contract for Cara (run 1 created a duplicate Draft); status still Active; PDF contains Cara / £1,150 / the dates / Gina.

## Phase 6 — Double-booking probe (expected to find a bug — log, don't fix)

21. - [ ] Re-open Room 2's public link (same URL) — note whether an application against a now-occupied room is even accepted; submit as **Dan** if it is.
22. - [ ] If Dan's booking arrives, **approve + convert** it ("Yes — activate now", no template) → carefully record what happens to Room 2's status, its linked tenant (Cara vs Dan), and both contracts. Suspected: the unit's tenant link and status get silently clobbered. Whatever happens, screenshot `/properties`, `/tenants`, `/contracts` and log it as a finding with exact before/after state.

## Phase 7 — Maintenance refresh regression (fix for BUG-2)

23. - [ ] `/maintenance`: set a status filter and a search term first, then **Raise job** (`E2E-Round2 boiler check`, E2E-Test House, category Plumbing, priority Low) → after the toast, clear the filter/search: the job is in the list **without any reload**, and your view state wasn't torn down by a full page refresh.
24. - [ ] Move it to Resolved, then Closed (keeps the board tidy for cleanup).

## Phase 8 — Shares + form sends (gaps from run 1)

25. - [ ] `/shares/new`: create a share for E2E-Portfolio → open the public share link in the second tab → submit an **agent offer** on any available unit (agent `E2E-Agent Amy`, `amy.e2e@example.com`, offer £1100) → booking appears in `/bookings` with source **share** and the offer price; converting it should default rent to the offer. (Stop after verifying the prefill — cancel the conversion.)
26. - [ ] `/forms`: pick or create a small form, **send** it (tokenised `/f/<slug>` link) → fill it in the second tab → response appears under the form's responses. Open the same tokenised link again → graceful handling (no crash; either reusable by design or a clear "already used" state — log which).

## Phase 9 — Tenant-isolation probes

27. - [ ] While logged into the test tenant, substitute the **foreign-tenant IDs** from the table above into detail URLs you know (e.g. `/properties/bb100000-0000-4000-8000-000000000003`, and the unit/contract IDs anywhere the UI routes by ID) → every one must 404/deny; **no foreign data may render**. Any leak is CRITICAL.
28. - [ ] Public apply URL with a **mismatched combination**: valid form slug `d101d8e1e96f` + the foreign unit ID → must be rejected (404/error), not render the foreign room.
29. - [ ] *(Optional — needs Ali)*: invite an **agent-role** (non-admin) user via `ali.abouel3aish+e2eagent@gmail.com`, log in as them in the second browser context, and confirm admin pages (`/settings/*`, `/admin/*`, property edit) are denied and the sidebar shrinks to entitled items.

## Phase 10 — Anna's closeout (completes run 1's lifecycle)

30. - [ ] Open Anna's **Notice Given** contract → **Closeout**: first try deposit returned `1500` (> the £1000 original) → must be rejected. Then: actual end date today, reason `tenant_notice`, arrears `0`, would re-let Yes, deposit returned `1000`, returned today, notes `E2E full return` → contract **Terminated**, Room 1 back to **Available**, deposit shows released, tenancy appears in the unit/property history.

## Phase 11 — Full destructive cleanup (run 1's skipped Phase 15 — LAST)

31. - [ ] Delete everything `E2E-` in reverse dependency order, verifying each delete control is red with a trash icon and confirms first: maintenance jobs → contracts (Cara's, Dan's if created, Anna's terminated one if deletable) → tenants (Anna, Cara, Dan) → bookings (all) → shares → forms/round-2 form + booking form → bank account → rooms → property → owner landlord + manager + both CRM landlords → portfolio.
32. - [ ] Verify `/properties`, `/bookings`, `/contracts`, `/tenants`, `/maintenance`, `/landlords` show their empty states and global search for `E2E-` returns nothing. Screenshot the empty states.

---

## Bug Log

| # | Phase/Step | URL | What I did | Expected | Actual | Severity | Screenshot |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
