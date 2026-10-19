# Harbor Ops — PM Module E2E Test Plan (Round 5 / "PM5")

**Scope:** the whole Property Management module as it stands on 2026-10-17 — ~55 routes. Rounds 1–3 only ever walked the lettings happy path, and the round-2/3 bug logs are empty. Since then the module has grown, and **33 uncommitted files (+2,332 / −1,127)** rewrote three things: contract generation, `ConvertToTenancyDialog`, and BoldSign signing. That rewrite is the highest regression risk in this round (Phase 4).

Prior rounds: [`e2e-browser-test-plan.md`](./e2e-browser-test-plan.md) · [`e2e-round2-test-plan.md`](./e2e-round2-test-plan.md) · [`e2e-round3-test-plan.md`](./e2e-round3-test-plan.md) · [run-1 report](./harbor-ops-e2e-test-report.md). Live report: [`e2e-pm-test-report.md`](./e2e-pm-test-report.md).

---

## 0. Stop — read before running anything

`.env.local` points the local dev server at the **production** Supabase project (`yblbulibirkyoyuzhosy`). localhost and the live site read and write the same rows. This is not a data boundary. The whole run is therefore built around containment:

| Guard | How |
|---|---|
| **Right tenant only** | Every writing script calls `assertWritableTenant()`, which resolves the signed-in account to its `tenants.slug` and refuses anything but `test`. A text check is not enough — "Property Co." is the fallback brand for several tenants. |
| **Recognisable data** | All test data is prefixed `PM5-`; emails are `*.pm5@example.com`; bank details are dummy (`12-34-56` / `12345678`). Never touches Truehold, Demo Agency, or the preserved `E2E-` rows from earlier rounds. |
| **Exact cleanup** | Prefix-matching alone can't undo writes to production — booking references are random, and child rows (invoices, `email_log`, `scheduled_messages`, storage blobs) don't carry the prefix. So every write phase records the exact id/key it creates via `track()` into `e2e/artifacts/pm/manifest.json`; p14 deletes from that manifest first, then sweeps by prefix as a backstop. |
| **No real sends** | Many PM email paths send immediately — `EMAIL_WORKER_DISABLED=1` only stops the outbox *drain*; welcome email, form send, reminder send-now, portal invite/login link, share booking, helpdesk, owner-statement send and rent reminders all call `sendEmail()`/Resend directly. The run drives each to its preview/confirm step and **never clicks the final send**. |
| **No background jobs** | Dev server started with `CRON_DISABLED=1`. Jobs are only ever triggered deliberately, and no cron phase sends. |

> **Side-effect sends.** Before Phases 4, 6 and 8, grep the actions those phases trigger (convert-to-tenancy, activate-tenancy, record-payment, month-close, statement-generate) for *reachable* `sendEmail`/Resend calls, not just buttoned ones. A synchronous send with no "Send" button to avoid is contained only by `EMAIL_WORKER_DISABLED` not applying to it — confirm each is safe or stub it before running the phase.

### Prerequisites

| Item | Value |
|---|---|
| URL | `http://localhost:3000` |
| Dev server | `EMAIL_WORKER_DISABLED=1 CRON_DISABLED=1 npm run dev`, background. **First** check port 3000 (`netstat -ano | grep ":3000.*LISTENING"`); if Ali's server is up, ask him once to stop it (it drains the prod outbox + runs cron). Clear `.next/cache/webpack` first (stale-Tailwind trap). Never `npm run build` while it is up. |
| Auth | `node e2e/login.mjs` once (human signs in, session saved), or auto-login via `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local`. Must be a **test-tenant admin**. |
| Fixtures | `node e2e/fixtures/build-fixtures.mjs` → `sample-contract.pdf`, `sample-photo.png`; `sample-statement.csv` is checked in. |
| Sandboxes | `BOLDSIGN_ENV=sandbox`, `MYDEPOSITS_ENV=sandbox`. Deposit/e-signing phases render only. |

### How to run

```bash
node e2e/pm/run.mjs                 # all phases in order, with the usage gate
node e2e/pm/run.mjs --from p05      # resume from the checkpoint
node e2e/pm/run.mjs --only p01      # one phase
node e2e/pm/report.mjs              # regenerate the report's auto sections
node e2e/usage-gate.mjs             # ok | wait | unknown (exit 0/10/0)
```

### Usage gate & resume protocol

The run manages its own Claude usage. `.claude/statusline-usage.mjs` writes `.claude/usage-snapshot.json`; `e2e/usage-gate.mjs` reads it and returns **ok** (proceed), **wait** (≥80% of the 5h window or ≥95% of the 7d window — pause), or **unknown** (no fresh snapshot — proceed, warn). Before every phase and every fix batch, run the gate.

- **On `wait`:** update the checkpoint row, create a one-shot cron at `resumeAt` with the prompt *"Resume the PM E2E run from the checkpoint in docs/e2e-pm-test-report.md"*, tell Ali the resume time in one line, end the turn.
- **Watchdog:** at run start, create a recurring cron (`17 * * * *`): *"PM E2E watchdog: read the checkpoint. If the run is incomplete and nothing is in progress, run `node e2e/usage-gate.mjs`; if ok, resume; else do nothing."* Cron fires only while idle, so it never interrupts work; a hard-limit kill is picked up on the next tick. `CronDelete` it when the run finishes.
- **If no snapshot is ever written** (the client doesn't run status-line commands — e.g. the VS Code extension), tell Ali once to continue from a terminal (`claude --continue` in `D:\SAAS`); until then the gate returns `unknown` and the hourly watchdog is the only safety net.

### Out of browser scope

Server actions with no UI caller, verified at DB/source level only: `deleteContract`, `updateMaintenanceJob`, `deleteMaintenanceJob`, `approveBooking`, `createResident`, `updateShareAction`, `resolveAlert`, and the unused `CreatePropertyDialog.tsx`.

### What every phase does automatically

`attachErrorCapture` runs on every page: it logs **every** `pageerror`, `console.error`, HTTP ≥500, Next error overlay / error boundary, and a loading skeleton still up after 10s — tagged with the step and route, written to the report's Captured section. `visit()` fails a route that bounces to `/login`, returns ≥400, shows an error boundary, or has no heading. `uiRulesProbe()` checks the CLAUDE.md UI rules (label above each input; visible hint distinct from the error; red `Trash2` on deletes; secondary variant on action buttons) and logs violations as **LOW**.

---

## Phase p00 — Preflight 🟢 READ-ONLY

1. - [ ] Usage gate is readable and not `wait`.
2. - [ ] Write guard: the signed-in account resolves to tenant slug `test`.
3. - [ ] PM module is live — `agency_module_configs.live_property_management_enabled` is true.
4. - [ ] Entitlement snapshot captured to `artifacts/pm/entitlements.json`; phases for OFF features will record `skip`, not `fail`.
5. - [ ] Tailwind stylesheet is live (h-11 = 44px) — guards the stale-CSS trap.
6. - [ ] Schema sanity (every migration is applied, so a miss here is a **bug**): `property_contracts.document_path` exists; `properties.contract_document_path` exists; the `property_contracts` storage bucket is **private**.
7. - [ ] Isolation smoke: a foreign-tenant property id denies — run *before* any write phase (the full sweep is p12, which runs last).

## Phase p01 — Route smoke 🟢 READ-ONLY

8. - [ ] All ~55 PM routes load at 1440px via `visit()` + error capture (every sidebar and BottomNav link).
9. - [ ] Id-addressed routes resolve their ids from the list page or `e2e/audit-fixtures.json`.
10. - [ ] `/forms/{id}` redirects to `/forms`; `/marketing` shows its "Coming soon" placeholder.
11. - [ ] Public routes load anonymously: `/portal/login`, `/f/{slug}`, `/s/{token}`.

## Phase p02 — Properties & units 🟡 WRITES

12. - [ ] Portfolio: empty-name submit shows an inline error.
13. - [ ] Create a property with every field; add a new owner and manager through the Ownership dialogs. Edit persists.
14. - [ ] Landlord contract PDF upload is served from `/api/properties/{id}/contract-document`, **not** a storage URL (new code).
15. - [ ] Rooms via setup: negative-price shows an inline error. `UnitDrawer` six tabs render.
16. - [ ] List / kanban / sheet views; filters; status changes incl. on-hold with a reason; kanban drag → `StatusPickerDialog`.
17. - [ ] Photos upload/delete; property detail tabs.
18. - [ ] Keys: add, check out, check in, history, mark lost.

## Phase p03 — Booking forms & public apply 🟡 WRITES

19. - [ ] Bank details saved (dummy values).
20. - [ ] Booking form with every question type. **Regressions:** BUG-3 (dropdown reads "3 options"; editing doesn't crash), BUG-4 (delete asks to confirm), BUG-2 (new items show without a reload). Reordering persists.
21. - [ ] Copy booking link: rent below minimum → inline error; £1000 → £231 holding deposit.
22. - [ ] Anonymous `/apply/{slug}/{unit}`: empty submit shows errors; two applicants; price tampering `?price=1` and `?price=99999` is clamped; a garbage unit id is handled gracefully; the legacy `/apply/{slug}` notice shows.

## Phase p04 — Bookings → tenancy → contract 🔴 WRITES · HIGHEST RISK

The rewritten area. One contract per tenant is the invariant.

23. - [ ] Board and list; drawer tabs; notes; under review; reject (reason required).
24. - [ ] Rewritten `ConvertToTenancyDialog`: terms visible with no template; rent pre-filled from the agreed price and deposit from the unit; rent required and > 0; "keep as draft" yields a draft with real terms and the unit becomes **booked**; activating makes it **occupied**.
25. - [ ] Template: upload `sample-contract.pdf`, place fields, AI-detect (one call), add a manual field.
26. - [ ] Generate from the booking **attaches to the existing contract** (exactly one contract per tenant). Document served at `/api/contracts/{id}/document`; anonymous fetch is denied.
27. - [ ] PDF text check: stamped values appear, including a Unicode name `PM5-Zoë Ångström` (Liberation Sans).
28. - [ ] Regenerate loses nothing; a live-contract lock is respected.
29. - [ ] `ContractDrawer`: expiry before start → inline error; collection day 45 → inline error (**BUG-6**). New Contract dialog with pro-rata.
30. - [ ] Signing panel and deposit wizards render and fail gracefully without credentials; **no sending**.

## Phase p05 — Tenants 🟡 WRITES

31. - [ ] List and filters; drawer, all 8 tabs.
32. - [ ] Right to rent; guarantor create/edit/delete.
33. - [ ] Documents upload; check whether the `pm-tenant-docs` passport URL can be fetched anonymously (**open security question**).
34. - [ ] Welcome email: **preview only**.
35. - [ ] `/tenants/{id}/reminders`: create an ad-hoc reminder, then cancel it.

## Phase p06 — Rent, statements, finances, profitability 🟡 WRITES · MONEY

36. - [ ] Record a part payment and a full payment (totals update); undo from the units list.
37. - [ ] Statements: upload `sample-statement.csv`; open the detail page; resolve a missing-rent flag; delete the upload.
38. - [ ] Overheads and tenant charges create/edit/delete (hand-rolled modals); post recurring.
39. - [ ] Month close: attest → review → close → reopen; summary report.
40. - [ ] Profitability: cost create/edit/delete; target upsert; maintenance cost synced.

## Phase p07 — Maintenance & compliance 🟡 WRITES

41. - [ ] New Work Order: empty submit errors; every field; gets a `WO-` reference; appears without a reload (**BUG-2**).
42. - [ ] Kanban drag; drawer cost (total updates and mirrors into profitability), photo, comments create/edit/delete, activity.
43. - [ ] Supplier create/edit/delete and assign; works-order PDF preview; deep links `?job=` and `?action=new`.
44. - [ ] **Vocabulary sweep:** the word "job" never appears on screen (UI says "work order").
45. - [ ] Certificates create/edit/delete with a document whose downloaded bytes match the upload; valid/expiring/expired bands; the property Certificates tab; global search.

## Phase p08 — Owners & statements 🟡 WRITES · MONEY

46. - [ ] Owner create/edit; properties table.
47. - [ ] Generate a statement; fee override; rechargeable toggle; adjustment line add/delete.
48. - [ ] PDF totals match the screen; regenerate doesn't duplicate; void. **No send.**

## Phase p09 — Forms, shares, automations, reminders, inbox, acquisition 🟡 WRITES

49. - [ ] Forms: build, duplicate; anonymous `/f/{slug}` submit appears in responses and downloads.
50. - [ ] Shares: create; anonymous `/s/{token}` (units, drawer, images zip); revoke shows the inactive-link page.
51. - [ ] Automations: create from a preset in **dry-run**; change mode (staying dry-run); template preview resolves placeholders and flags unknown ones.
52. - [ ] Reminders: snooze, dismiss, edit the queued message.
53. - [ ] Inbox: fixture request detail; reject.
54. - [ ] Acquisition: wizard incl. the AI step (one call); detail tabs; status change.

## Phase p10 — PM settings 🟡 WRITES (API keys only)

55. - [ ] Every settings page renders and its forms validate.
56. - [ ] API keys: create; 401/403 checks against the public API; revoke and delete.
57. - [ ] Email, integrations, e-signing, deposits, billing-info **render only** — nothing activated or connected.

## Phase p11 — Dashboard, search, help, UI rules 🟡 WRITES (todos only)

58. - [ ] PM dashboard reflects the PM5- data; todos and quick links create/edit/delete and reorder.
59. - [ ] Global search for property, tenant, booking reference, `WO-` reference and certificate.
60. - [ ] `/assistant` answers one question (one call); helpdesk dialog validation only (no submit).
61. - [ ] UI-rules sweep over every page and dialog visited.

## Phase p12 — Isolation 🟢 READ-ONLY · CRITICAL

62. - [ ] Foreign-tenant ids (round 2) on every PM id route, plus `/api/contracts/{foreign}/document` and `/api/properties/{foreign}/contract-document`. Every one denies; any foreign data rendering is **CRITICAL**.
63. - [ ] Re-run `e2e/phase9-isolation.mjs` and `e2e/phase12-sweeps.mjs`.

## Phase p13 — Mobile regression 🟢 READ-ONLY

64. - [ ] `npm run mobile:audit` and `node e2e/mobile-dialog-audit.mjs` are green.

## Phases p15–p17 — Gap-fill coverage (added 2026-10-17) 🟡 WRITES

Added after the first pass to cover the areas Ali flagged. Acquisition tests are excluded per request. **Key enabler:** a tenancy can be created without the contract migration — `convertBookingToTenancy` only writes existing `property_contracts` columns (`bookings.ts:159`); only PDF *generation* needs migration 20261016000001. So the rewritten `ConvertToTenancyDialog` and everything downstream (rent, owner maths) are testable now.

- **p15 — Tenancy + rent + month close.** Seed a booking (service-role, to avoid the apply-form's agency email), drive `ConvertToTenancyDialog` (terms prefilled from the agreed price, activate → `active` contract + `occupied` unit, Unicode applicant `PM5-Zoë Ångström`), record a rent payment (on the correct unit), run month-close **attest + review**. Month **close** is skipped — reopen needs super-admin and the E2E account is admin, so closing would lock a production month irreversibly.
- **p16 — Owner-statement maths (MONEY).** Owner-statement rent is the **landlord rent-owed** (`properties.monthly_rent_owed`, rent-to-rent model), deliberately **not** tenant payments (`generate.ts:170`). Verifies management fee = effective % of rent (10% standing / 15% override), rechargeable work-order cost flows to "works", adjustment line add/delete, and the PDF renders from the computed net.
- **p17 — Deep sub-flows.** Guarantor create/delete and Right-to-Rent (which surfaced **PM-008** — every tenant drawer edit failed). BUG-3's no-crash core (switching a question to a dropdown) is checked; the full "3 options" display, keys lifecycle, photo upload and kanban drag are skipped (brittle / lower-value) and noted for manual re-verification.

## Phase p14 — Cleanup 🟡 DELETES (intended)

65. - [ ] Delete through the UI in reverse dependency order; each delete is red, uses `Trash2`, and asks to confirm. (Cleanup now also does a linkage sweep for untracked child rows — guarantors, owner_transactions, rent_payments, work-order costs — before deleting their PM5 parents.)
66. - [ ] Service-role sweep from the manifest first, then by prefix (tenant `test` **AND** `PM5-`; list before delete) for rows with no UI delete (e.g. contracts) and storage objects.
67. - [ ] Global search for `PM5-` returns nothing.

---

## Fixing

Triage the log (dedupe; read each root cause in code; mark scripted false alarms). Fix by severity (CRITICAL → HIGH → MEDIUM → LOW), following CLAUDE.md: Zod on client **and** server with inline errors; label + hint + tooltip on every field; red `Trash2` on deletes; a new timestamped migration for any schema/RLS change (never edit existing ones; list it in the report as pending manual apply); no "job" wording; an `onInvalid` toast so validation can't fail silently. After each batch: usage gate, `npx tsc --noEmit`, `npm test`, and re-run the phase script(s) that caught the bug. Mark fixed → verified. Items needing a product decision go in the report's "Needs a product decision" table.

## Verification (end of run)

Re-run everything (`node e2e/pm/run.mjs`, p00→p14, reseed + clean up): **zero FAIL**, every SKIP has a reason, every bug row verified or flagged for decision. `npx tsc --noEmit` and `npm test` green. Mobile audits green. `npm run build` passes (after stopping the run's dev server, then restart it for Ali). Global search for `PM5-` empty. `CronDelete` the watchdog. Final reply to Ali: counts (found / fixed / needs decision), migrations pending manual apply, links to the report and plan.
