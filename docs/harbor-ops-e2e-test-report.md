# Harbor Ops — End-to-End Browser Test Report

**Environment:** http://localhost:3000 (localhost only, per instruction)
**Tester:** Claude (browser automation) · Admin user "claude test" · Agency "Property Co."
**App date during run:** July 2026 (contract start 06/07/2026)
**Scope:** Full lifecycle — portfolio -> landlord -> property -> rooms -> booking form -> bank details -> public application -> booking review -> convert to tenancy -> contract PDF -> tenant -> rent collection -> deposit -> maintenance -> profitability -> finances -> notice & closeout.
**Result:** Phases 0-14 executed and verified. Phase 15 (destructive cleanup) intentionally NOT run — records preserved at user request.

---

## Summary

| Phase | Area | Result |
|---|---|---|
| 0-4 | Portfolio, landlord, property, rooms, booking form, bank details | PASS (with bugs logged) |
| 5 | Public application (Anna + Bob) | PASS |
| 6 | Booking review | PASS |
| 7 | Convert to tenancy (contract) | PASS after fix — see BUG-1 (HIGH) |
| 43/47/48 | Contract template + PDF generation | PASS (PDF byte-verified) |
| 9 | Rent collection | PASS |
| 10 | Deposit protection (MyDeposits + TDS) | PASS (graceful not-configured states) |
| 11 | Maintenance | PASS (refresh bug observed) |
| 12 | Profitability | PASS |
| 13 | Finances | PASS |
| 14 | Notice & closeout | PASS |
| 15 | Cleanup (destructive) | NOT RUN (records kept) |

---

## Records Created (kept, not deleted)

| Record | Detail | ID |
|---|---|---|
| Portfolio | E2E-Portfolio | 5bb64682-c560-440d-8024-bd573ee5ed7d |
| Owner landlord | E2E-Owner Larry · larry.e2e@example.com · +447700900001 | bee7e5c2-6217-40e6-90e0-49b278d19e22 |
| Property manager | E2E-Manager Mia · E2E-Mgmt Ltd · mia.e2e@example.com | a48cb748-076e-4492-a56b-59a99dec15d6 |
| Property | E2E-Test House · 12 Test Street, Flat B, E1 6AN, Whitechapel · Aldgate East | 4061e689-98c1-4cf1-bbdd-cef1c324ff28 |
| Booking form | E2E-Application Form · /apply/d101d8e1e96f · 6 questions | — |
| Room 1 (Double) | £950-1000 pcm · deposit £1000 · holding £230 · now Move Out | 9e41cdd1-cf3e-4674-8a47-48da85f5ec2b |
| Room 2 (Ensuite) | £1100-1200 pcm · couples £1300 · Available | — |
| Booking — Anna | E2E-Applicant Anna · anna.e2e@example.com · +447700900002 · Approved | BK-K6R92 |
| Booking — Bob | E2E-Applicant Bob · bob.e2e@example.com · +447700900003 · Pending | BK-3GT43 |
| Tenant | E2E-Applicant Anna (Room 1) | — |
| Contract (Active->Notice Given) | £1000/mo · deposit £1000 · 06/07/2026 -> 06/07/2027 · collection day 1st · Email | — |
| Contract (Draft, from template) | Duplicate created by template-generation flow — see OBS-1 | — |
| Contract template | E2E-AST Template · E2E-Portfolio · 9 fields (Guarantor = manual) | 39fcc0f5-9ac4-4f8f-afea-45e65ed66b8c |
| Bank account | E2E-Portfolio · Main account (Default) · Holder E2E Lettings Ltd · Barclays | — |
| Rent payment | July 2026 · £1,000 paid in full | — |
| Maintenance job | E2E-Leaking tap in Room 1 · Plumbing · High · In Progress | — |

---

## BUG LOG

### BUG-1 (HIGH) — Convert-to-tenancy creates £0/£0 contract with no warning
Convert-to-tenancy without a template creates an ACTIVE contract with rent £0 / deposit £0 and no warning. The dialog only shows rent/deposit/date fields when a template is selected; the server action hardcodes 0/0 ("Admin fills in the details") even though it already computes the correct defaults (agreed price, unit deposit) for the dialog.
- **Root cause:** confirmed in code (no retest needed).
- **Note:** blank expiry (rolling/periodic) is by design and is NOT part of this bug.
- **Workaround used:** edited the contract to the plan values (rent £1000, deposit £1000, start 06/07/2026, expiry +12mo).

### BUG-2 (MEDIUM) — New records don't appear until page reload (refresh bug)
After creating a record the success toast fires, but the list does not refresh — the new item is missing until a manual page reload. Confirmed on the question/booking-form new-form flow and **also newly confirmed on Maintenance** (raising "E2E-Leaking tap in Room 1" showed "Job raised" but the list still read "0 jobs total / No maintenance jobs yet" until reload).
- Note: in-place status updates (e.g. maintenance Open -> In Progress, contract -> Notice Given) DO refresh correctly; only the create-new path is affected.

### BUG-3 (MEDIUM) — Question dropdown crash + option miscount
Dropdown-type questions throw "options.map is not a function" (crash) and mislabel the option count ("38 options"). Root cause confirmed in code.

### BUG-4 (MEDIUM) — Missing delete confirmation on questions
Deleting a booking-form question happens with no confirmation dialog — destructive action with no guard.

### BUG-5 (MEDIUM) — /landlords CRM form label/validation violations
The landlord (CRM) form uses placeholder-only labels (no visible label above inputs) and relies on native browser validation instead of inline field errors. Root cause confirmed in code.

### BUG-6 (LOW) — Contract edit form: silent required-field validation
On the contract edit form, required fields (Collection day, Signing method) block save with no visible inline error — focus just moves. Same class as the cross-cutting "no inline validation" issue. (Contributed to a failed save attempt during the BUG-1 fix.)

### BUG-7 (LOW / code smell) — "+ New" links easy to miss
The "+ New" text link that creates owner-landlord / property-manager records (in the property Ownership section) is a tiny brand-coloured text link at the right end of the label row — easy to miss.

### BUG-8 (LOW / code smell) — Swallowed fetch errors
The property form swallows fetch errors into an empty list (`.catch(() => [])`), which would mask a real backend failure as a harmless-looking empty dropdown.

---

## OBSERVATIONS (not classified as bugs)

### OBS-1 (MEDIUM) — Duplicate contract from template generation
"Generate contract from template" (from the booking Actions tab) creates a SEPARATE new **Draft** contract with the PDF attached, rather than attaching the PDF to the existing **Active** contract. Result: two contracts for the same tenant/room (one Active with no document, one Draft with the PDF). Worth confirming whether this is intended (draft-for-signing) vs. an accidental duplicate.

### OBS-2 (LOW) — "2 months" vs "60 days" wording
The contract Notice tab says "2 months notice"; the Give Notice dialog computes "notice date + 60 days" (06/07 -> 04/09). Functionally fine, just inconsistent wording.

### OBS-3 (INFO) — Costs figures
Profitability/Finances show Total Costs £2,000 categorised as "Owner Rent" (seeded/expected owner payment), driving Net Profit negative. Internally consistent; noted for context. Finances also flags Admin overheads / recurring tenant charges / monthly close as "coming in upcoming phases" (stubbed features, not bugs).

---

## NOT BUGS / RECLASSIFIED (verified false alarms)

- **Owner-landlord dropdown "empty" ("— None —")** — correct; records are created via the "+ New" link (see BUG-7). Removed as a blocker.
- **"Sheet view missing"** — deploy lag between test.harborops.co.uk and localhost, not a bug (test on localhost only).
- **Step 31 rent-below-minimum** — validation DOES fire: entering £500 and clicking "Copy link" shows inline "Must be at least £950." and does not copy. Confirmed NOT a bug.
- **Blank contract expiry (rolling/periodic)** — by design (Renters Rights Act 2025 periodic tenancies).
- **Deposit protection not connected (MyDeposits + TDS)** — graceful empty states, no crash; expected without sandbox credentials (step 55).

---

## KEY VERIFICATIONS

### Contract PDF (steps 43/47/48) — byte-verified
The generated PDF's content streams were decompressed and the stamped field values confirmed:

| Field | Value |
|---|---|
| Tenant name | E2E-Applicant Anna |
| Property | E2E-Test House |
| Monthly rent (PCM) | £1,000 |
| Deposit | £1,000 |
| Tenancy start date | 06/07/2026 |
| Tenancy end date | 06/07/2027 |
| Guarantor name (manual) | E2E-Guarantor Gary |
| Signed | E2E-Applicant Anna |
| Date (computed) | 2026-07-06 |

### Rent collection
Recorded £1,000 (July 2026); dashboard updated live: Paid £1,000 · Arrears £0 · On track.

### Notice & closeout cascade
Tenant notice on Active contract -> status "Notice Given" -> Room 1 status "Move Out", available 4 Sept 2026 (notice + 60 days). Cascade verified end-to-end.

---

## Constraints honoured during the run
- Tested on localhost:3000 only.
- Financial handoff: sort code / account number entered by the user (Ali), never by Claude.
- Login credentials/passwords never submitted by Claude (user re-logged in after session expiries).
- Phase 15 destructive deletions not performed — records preserved as requested.

*Report generated 2026-07-06T04:08:04.503Z by Claude browser automation.*
