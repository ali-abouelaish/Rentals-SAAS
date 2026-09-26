# Harbor Ops — Round 3 Browser Test Plan (features built since round 2)

**Scope:** everything shipped after the round-2 plan was written (2026-07-06) — 50 migrations' worth. Rounds 1 and 2 cover the lettings core (portfolio → property → booking → contract → rent → notice). None of it covers what is below.

Prior rounds: [`e2e-browser-test-plan.md`](./e2e-browser-test-plan.md) · [`e2e-round2-test-plan.md`](./e2e-round2-test-plan.md) · [run-1 report](./harbor-ops-e2e-test-report.md).

---

## 0. Stop — read before running anything

Round 2's prerequisite said "localhost only". **That is not a data boundary.** `.env.local` points the local dev server at the production Supabase project (`yblbulibirkyoyuzhosy`), the same ref as `.mcp.json`. localhost and the live site read and write the same rows. Confirmed 2026-09-15, when a round-2 sanity run landed in the live **Truehold** agency (11 properties, 44 units).

Several features below **send email to real people** and **move real money figures**. Do not start until all three are true:

| # | Precondition | How |
|---|---|---|
| P1 | The run targets a **non-production database** — a Supabase branch, a restored copy, or at minimum a disposable tenant nobody else uses | new `NEXT_PUBLIC_SUPABASE_URL` + keys in `.env.local`, server restarted |
| P2 | **Outbound email is contained** | `EMAIL_WORKER_DISABLED=1` — messages queue into `email_outbox` and are asserted there instead of being delivered |
| P3 | **Background jobs do not fire on their own** | `CRON_DISABLED=1`, then trigger each job deliberately via `GET /api/cron/<job>` with `Authorization: Bearer $CRON_SECRET` |

Also: `BOLDSIGN_ENV=sandbox`, and `MYDEPOSITS_ENV=sandbox`.

**If P1 cannot be met, run only the phases marked 🟢 READ-ONLY.** Everything else writes.

---

## Prerequisites

| Item | Value |
|---|---|
| URL | `http://localhost:3000` |
| Harness | `e2e/` — `node e2e/login.mjs` once (human signs in, session saved), then each phase script |
| Login | A **test-tenant admin**, never the live Truehold account |
| Second context | The harness's `openAnonymous()` for public/portal/share links |
| Entitlements | Several features are **paid** and OFF by default — see Phase 1 |

### New test data

| Entity | Value |
|---|---|
| Certificate | `R3-Gas Safety`, expires **+20 days** (inside the reminder window) |
| Supplier | `R3-Plumber Pete`, `pete.r3@example.com`, trade Plumbing |
| Works order | `R3-Boiler service` on any occupied unit |
| Owner | reuse an existing owner-landlord with a fee % set |
| Automation rule | `R3-Rent reminder`, 3 days before due |
| Portal renter | an existing `pm_tenant` with an email you control |

---

## Phase 1 — Entitlements & paid integrations 🟡 WRITES

The newest and least-exercised gate in the app. `PAID_FEATURES` (`e_signing`, `mydeposits`, `tds`, `dps`) **invert the default**: absent a subscription row they are OFF, unlike every other feature. Getting this wrong either bills nobody or exposes a paid feature free.

1. - [ ] `/settings/integrations` renders the catalogue; each card shows an accurate state (available / active / coming soon). Page must be **dynamic, not cached** — open it as two different tenants and confirm no bleed (it was statically prerendered until 2026-09-13).
2. - [ ] Activate one integration → row appears in `tenant_integration_subscriptions`; the gated feature's **sidebar item appears without a manual reload**; the matching `/settings/*` page becomes reachable.
3. - [ ] Deactivate it → sidebar item disappears, the page 404s (`requireFeature`), and any deep link to it is denied.
4. - [ ] **Grandfathering:** a tenant with prior evidence of use but no subscription row must retain access. Verify against a tenant that used the feature before the paid flip.
5. - [ ] Super admin `/admin/tenants/<id>/features`: toggle a paid feature ON **without** a subscription (the trial/goodwill path) → tenant gets access; toggle OFF → revoked. Confirm this overrides the subscription state in both directions.
6. - [ ] Billing: activating mid-month starts the period on the 1st of next month (see `e2e` unit tests for billing dates — confirm the UI agrees with them).

## Phase 2 — E-signing / BoldSign 🟡 WRITES · needs sandbox

Legal documents sent to real signers. Sandbox only.

7. - [ ] `/settings/e-signing` with no subscription → the "coming soon"/upsell state, not a crash.
8. - [ ] With the entitlement on: request a **sender identity** → status reflects *pending* vs *declined* distinctly (the 2026-09-12 migration exists precisely because "not verified" and "declined" both used to read as null).
9. - [ ] **Envelope balance**: shows remaining envelopes; sending decrements it; hitting zero blocks a send with a clear message rather than failing at the API.
10. - [ ] Contract template: place **signature fields** in the editor → they persist in PDF points, top-left origin, and land where drawn (cross-check with `node e2e/../api/dev-works-order-preview` equivalent for contracts, or the stamped preview).
11. - [ ] Send a contract for signature → BoldSign document created; contract `signing_method` records boldsign; drawer shows live status.
12. - [ ] **Webhook**: POST a signed-event payload to `/api/webhooks/boldsign` with a **valid** HMAC → status advances. Repeat with an **invalid** signature → rejected. This is an unauthenticated public endpoint; signature verification is the only guard.
13. - [ ] Works order signing: raise a works order → send to `R3-Plumber Pete` → contractor signs in the sandbox → status and PDF update.
14. - [ ] Cancel/decline paths: a declined document must not leave the contract stuck in a sending state.

## Phase 3 — Compliance certificates 🟡 WRITES

15. - [ ] `/compliance`: add `R3-Gas Safety` expiring in 20 days against a property → appears in the list with correct days-remaining.
16. - [ ] Expiry banding renders correctly (valid / expiring soon / expired) — set one of each.
17. - [ ] Certificate appears in **global search** (it has a search-union migration) — search `R3-Gas` and confirm the result kind and href.
18. - [ ] The certificate-expiry **automation** queues a reminder: trigger `/api/cron/automation-sweep` → row lands in `email_outbox`/`scheduled_messages` addressed correctly. Assert the queued row; do **not** deliver it.
19. - [ ] Attach a document to the certificate; download it back and confirm bytes match.
20. - [ ] Maintenance **trades certification**: a supplier whose certification has lapsed is flagged when assigned to a works order.

## Phase 4 — Automations, reminders & messaging 🔴 WRITES · SENDS

**The highest-risk area in the app.** These paths email real renters. P2 (`EMAIL_WORKER_DISABLED=1`) is mandatory; every assertion is on the **queued row**, never on delivery.

21. - [ ] `/automations`: create rule `R3-Rent reminder`, 3 days before rent due, against a template.
22. - [ ] `/automations/templates`: edit a template containing `{{renter_name}}` / `{{property_address}}` → preview resolves them; an unknown placeholder is reported in "Unfilled placeholders" rather than shipping `{{raw}}` to a renter.
23. - [ ] Trigger `/api/cron/message-drain` and `/api/cron/automation-sweep` → correct number of `scheduled_messages` rows, correct recipients, **no duplicates on a second run** (the jobs must be idempotent).
24. - [ ] Edit a queued message before send → the stored final text changes; placeholders already resolved are not re-resolved.
25. - [ ] **Communication preferences / unsubscribe**: open a `/preferences` token link → opting out suppresses the next queued message for that renter. This is a legal requirement, not a nicety.
26. - [ ] `/reminders`: create a manual reminder; confirm it queues and can be cancelled before send.
27. - [ ] **Rent-reminder parity** (per the cutover runbook): run the legacy path and the automations path over the same data and diff the recipient lists. They must match exactly before cutover.

## Phase 5 — Multi-provider email 🟡 WRITES

28. - [ ] `/settings/email`: the chooser shows Resend (default) + Graph / Gmail / SMTP.
29. - [ ] SMTP: enter credentials → **Verify** succeeds with good creds and fails with a clear error on bad ones; the password is stored encrypted (`EMAIL_PROVIDER_TOKEN_SECRET`), never echoed back to the browser.
30. - [ ] Graph/Gmail OAuth: connect → callback consumes state → connection recorded. Replay the same callback URL → **rejected** (state is single-use).
31. - [ ] `/api/cron/email-provider-health` marks a broken provider unhealthy → sends **auto-fall back to Resend** and the agency gets an alert. Verify the fallback actually queues via Resend.
32. - [ ] `email_log` records provider, status and message id per send.

## Phase 6 — Owner statements & owner portal 🟡 WRITES · MONEY

Figures here are what a landlord is told they are owed. Arithmetic errors are the expensive kind.

33. - [ ] `/owners`: an owner-landlord is first-class (2026-07-30) — detail page, not just a dropdown value.
34. - [ ] Generate a statement for a period with rent received, a maintenance cost marked **recharge**, and one not → recharged cost appears against the owner, non-recharged does not.
35. - [ ] **Fee override** on one property overrides the owner's default % for that property only; the statement shows both the rate used and the source.
36. - [ ] `owner_transactions` rent-due rows reconcile against `/rent-collection` for the same period — no double counting.
37. - [ ] Trigger `/api/cron/owner-statements` → statements generate for the right period; a second run does **not** duplicate.
38. - [ ] Statement PDF: totals on the PDF equal the totals on screen (byte-verify like run 1 did for contracts).
39. - [ ] Statement flags: raise a flag via `/api/statements/[id]/flags`, resolve it, confirm audit trail.

## Phase 7 — Maintenance: suppliers, comments, works orders 🟡 WRITES

40. - [ ] Add supplier `R3-Plumber Pete` with trade + certification; assign to a job.
41. - [ ] Job comments: add, edit, delete — with the delete guarded by a confirm and a red `Trash2` button.
42. - [ ] Raise a **works order** from a job → gets a `WO-` reference (2026-08-21 migration), renders a PDF, and appears in global search under the work-order kind.
43. - [ ] Cost with **recharge to owner** flag on/off flows through to Phase 6's statement correctly.
44. - [ ] **Vocabulary check:** the UI must never say "job" to a user — it is a "work order" throughout. Sweep every visible string on `/maintenance`, the drawers and the PDF.
45. - [ ] AI triage: raise a ticket through the public support widget → triage classifies it; a low-confidence case degrades gracefully rather than guessing.

## Phase 8 — Tenant portal 🟡 WRITES · public surface

46. - [ ] Request a magic link for a portal renter → email **queues** with a tokenised link; the link signs them in; an expired/tampered token is refused.
47. - [ ] Portal shows only that renter's tenancy — substitute another renter's ids into portal URLs → denied. Portal pages must carry `X-Robots-Tag: noindex`.
48. - [ ] Rate limiting on `/api/portal/login-link` — hammer it and confirm it throttles rather than emailing on every request.
49. - [ ] Renter raises a maintenance ticket from the portal → lands in `/maintenance` against the right unit.

## Phase 9 — Listings, spreadsheets & the SpareRoom scraper 🟡 WRITES

50. - [ ] Put a Listings sheet URL **on a landlord** (there is no separate tab) → auto-maps columns → rows land in `scraped_listings`.
51. - [ ] Google Sheets **hyperlink** columns survive import (CSV export drops URLs — the importer must use the Sheets API with `includeGridData`).
52. - [ ] Drive room-photo import: with a service account → photos import; **without** → listings still import and photos are skipped, no crash.
53. - [ ] Trigger `/api/cron/spareroom-scraper` → upsert-then-sweep on `spareroom:<id>`; **row ids survive the run** and `leads.listing_id` links are not severed. This is the regression that the 2026-08-22 rewrite exists to prevent.
54. - [ ] A landlord whose source fails to read keeps their existing rows and their **Last scraped** date stops moving (turns red after a week) — it must not wipe them.
55. - [ ] Schedule sanity: the scraper is at **09:00** and shares that tick with rent-reminders (deliberate, per 2026-09-15). Confirm `/admin/health` reports both.

## Phase 10 — Deposits: TDS & DPS 🟡 WRITES · needs sandbox

56. - [ ] `/admin/deposit-schemes`: enter per-agency TDS and DPS credentials → stored encrypted; never rendered back.
57. - [ ] DPS: protect a deposit → `client_secret_post` auth (not Basic), ISO dates, HTTP 201, `response.depositId` persisted.
58. - [ ] TDS: protect a deposit; poll `/api/cron/tds-poll` → status advances.
59. - [ ] mydeposits: known-blocked upstream at `POST /tenancies` — confirm the failure surfaces as a clear agency-facing error, not a silent stall.
60. - [ ] With **no** scheme configured, the deposit UI shows the graceful not-configured state (run 1 verified this; re-confirm after the paid-feature flip).

## Phase 11 — Admin, health & platform billing 🟢 READ-ONLY (mostly)

61. - [ ] `/admin/health`: every cron job listed with last-run and staleness against `jobCatalogue.ts` thresholds. Kill a job's last-run timestamp → it reports stale.
62. - [ ] `/admin/activity`: activity log records the right actor and tenant.
63. - [ ] `/admin/billing` + `platformInvoices` job: an agency's usage rolls up correctly; `usageRollup` and the invoice agree.
64. - [ ] `/settings/api-keys`: mint a key with `scraped_listings:read` → `/api/public/scraped-listings` accepts it; a key **without** the scope gets 403; a revoked key gets 401.

## Phase 12 — Cross-cutting regressions 🟢 READ-ONLY

Cheap, scripted, and worth running on every build.

65. - [ ] **Isolation sweep** (round 2 Phase 9, extended): foreign-tenant ids into every id-routed URL across the *new* features — certificates, works orders, statements, portal, integrations. Any foreign render is CRITICAL.
66. - [ ] **Unauthenticated API sweep**: every `/api/*` route hit with no session must 401/403/404 — never return data. Re-run after the 2026-09-13 fixes (an open email relay and an open OpenAI proxy were found and closed).
67. - [ ] **Cron auth sweep**: every `/api/cron/*` without a bearer token → 401, including when `CRON_SECRET` is unset (fail-closed).
68. - [ ] **UI rules sweep** (per CLAUDE.md) on every new page: visible label above each input, always-visible hint, inline Zod error below the field, red `Trash2` delete, tenant secondary variant on action buttons, tooltips on non-obvious controls.
69. - [ ] **Help coverage**: every new page has a registered help article and the assistant can answer from it.
70. - [ ] **Entitlement gating**: every sidebar item is gated by an entitlement row, and every new feature appears in the super-admin features manager.

---

## Suggested order

Phases 12 → 1 → 4 → 6 first. 12 is read-only and catches regressions cheaply; 1 gates everything else; 4 and 6 carry the real-world consequences (mail to renters, money owed to landlords). The sandbox-dependent phases (2, 10) can wait on credentials without blocking the rest.

## Bug Log

| # | Phase/Step | URL | What I did | Expected | Actual | Severity | Screenshot |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
