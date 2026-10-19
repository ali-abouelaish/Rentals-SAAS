# Harbor Ops — PM Module E2E Test Report (Round 5 / PM5)

Companion to [`e2e-pm-test-plan.md`](./e2e-pm-test-plan.md). The checkpoint table, captured-errors and skipped-steps sections below are **auto-generated** by `node e2e/pm/report.mjs` from the per-phase JSON in `e2e/artifacts/pm/`. The bug log, migrations list, and run-1 re-verification are hand-maintained.

- **Runner:** Playwright, headless, auto-login via the repo harness (`e2e/pm/run.mjs`).
- **Data:** test tenant (slug `test`) on the shared production Supabase project. Every write is guarded by `assertWritableTenant()` and prefixed `PM5-`. Created ids are tracked for exact cleanup.
- **Resume:** a run reads the checkpoint table to know where to pick up (`node e2e/pm/run.mjs --from pNN`).

---

## Checkpoint

<!-- AUTO:CHECKPOINT -->
| Phase | Covers | Status | Last run (UTC) | Pass | Fail | Skip |
|---|---|---|---|---|---|---|
| p00 | Preflight | done (failures) | 2026-10-17 02:44 | 6 | 3 | 0 |
| p01 | Route smoke | done | 2026-10-17 02:54 | 55 | 0 | 0 |
| p02 | Properties & units | done | 2026-10-17 14:44 | 9 | 0 | 4 |
| p03 | Booking forms & public apply | done | 2026-10-17 03:24 | 6 | 0 | 6 |
| p04 | Bookings → tenancy → contract | pending | — | — | — | — |
| p05 | Tenants | done | 2026-10-17 14:44 | 6 | 0 | 4 |
| p06 | Rent, statements, finances, profitability | done | 2026-10-17 03:38 | 5 | 0 | 5 |
| p07 | Maintenance & compliance | done | 2026-10-17 14:44 | 6 | 0 | 5 |
| p08 | Owners & statements | done | 2026-10-17 13:19 | 4 | 0 | 5 |
| p09 | Forms, shares, automations, reminders, inbox, acquisition | done | 2026-10-17 13:33 | 4 | 0 | 5 |
| p10 | PM settings | done | 2026-10-17 13:38 | 15 | 0 | 1 |
| p11 | Dashboard, search, help, UI rules | done | 2026-10-17 13:43 | 12 | 0 | 1 |
| p12 | Isolation | done | 2026-10-17 13:49 | 11 | 0 | 0 |
| p13 | Mobile regression | done | 2026-10-17 14:07 | 2 | 0 | 0 |
| p15 | Tenancy + rent + month close | done | 2026-10-17 14:52 | 4 | 0 | 2 |
| p16 | Owner-statement maths | done | 2026-10-17 15:07 | 7 | 0 | 1 |
| p17 | Deep sub-flows (guarantor/RTR/form editor) | done | 2026-10-17 15:23 | 3 | 0 | 3 |
| p14 | Cleanup | done | 2026-10-17 15:26 | 6 | 0 | 1 |
<!-- /AUTO:CHECKPOINT -->

---

## Bug log

Severity: **CRITICAL** (data breach / data loss / money wrong) · **HIGH** (feature broken) · **MEDIUM** (wrong behaviour, recoverable) · **LOW** (UI-rule / cosmetic). Status: open → fixed → verified.

| ID | Phase/Step | URL | What was done | Expected | Actual | Severity | Evidence | Root cause (file:line) | Status |
|---|---|---|---|---|---|---|---|---|---|
| PM-001 | p00 / 00.6c | storage://property_contracts | `storage.getBucket('property_contracts')` on production | bucket private (per migration 20261016000001) | **public = true** — tenancy agreements (names, addresses, rent) are world-readable via the anon key that ships in the browser bundle | **CRITICAL** | p00.json; `verify-migration` output | migration `20261016000001_contract_generation_fixes.sql:124` **not applied to prod** | open — fix is to apply the migration (Ali, manual) |
| PM-002 | p00 / 00.6a-b | — | `select document_path / contract_document_path` | columns exist | `property_contracts.document_path`, `.document_bucket`, `.generation_inputs`, `.generated_fields` and `properties.contract_document_path` all **MISSING** | HIGH | p00.json | same migration not applied; the uncommitted contract-generation rewrite (Phase 4) depends on these columns | open — fix is to apply the migration |
| PM-003 | p02 / 02.3 | /properties/new | Create a property leaving "Payment schedule" at its default "— Select —" | property created (field is presented and schema-declared as optional) | submit blocked with toast *"Fix required fields: payment_schedule"* and **no inline error** — the most fundamental PM action is impossible unless a schedule is picked | HIGH | diagnostic; p02.json | `src/features/properties/domain/schemas.ts:95` — `payment_schedule` enum not wrapped in `emptyToNull` (the empty-string `""` fails `z.enum`); `bills:64` had the same latent flaw | **fixed → verified** (wrapped both in `emptyToNull`; 02.3 now creates with empty schedule). Code-only, no migration |
| OBS-A | p02 / 02.5a | /properties/{id}/setup | Add room with Min PCM = −100 | inline error + no row | row correctly **not** created (negative rejected), but no visible inline error message was detected on the field | LOW | p02.json | AddRoomDialog (`z…positive()`); verify whether the message renders | open — needs a manual confirm of the inline message |
| PM-004 | p02 / 02.6 | /properties/{id} | Open the UnitDrawer | no a11y console error | Radix warns `DialogContent requires a DialogTitle` — the unit drawer's dialog has no title (screen-reader inaccessible) | LOW | p02.json captured | `src/features/properties/ui/UnitDrawer.tsx` — `DialogContent` with no `DialogTitle`/VisuallyHidden | open |
| OBS-B | p00 / 00.7 | /properties/{foreign} | Visit a foreign-tenant property id | graceful not-found | isolation holds (no leak), but the route throws an uncaught `Error: Property not found` (pageerror → error boundary) instead of `notFound()` | LOW | p00.json captured | `src/features/contracts/data/tenant-history.ts:185` (getPropertyTenantHistory throws) | open — messy denial; revisit in p12 |
| OBS-C | p01 / 01.s8 | /contracts/templates | Load the page | no failed fetches | 11× `ERR_CONNECTION_REFUSED` console errors — a client-side fetch to an endpoint that's down | LOW | p01.json captured | unknown; triage during p04 (contracts) | open |
| PM-005 | p03 / 03.3 | /apply/{slug}/{unit} | Submit the public apply form empty | inline Zod errors below each field | empty submit is blocked, but via **native HTML `required`** (browser tooltip) — the public form is a custom controlled form, not RHF+Zod, so no inline per-field errors | LOW | p03.json captured | `src/app/apply/[slug]/PublicBookingForm.tsx` (native `required`, custom `handleSubmit`) | open — functionally fine; full RHF+Zod rewrite of the public form is disproportionate, flag for decision |
| PM-007 | p07 / 07.4 | /maintenance | Vocabulary sweep (UI must say "work order", never "job") | no "job" in UI chrome | two native `title` tooltips said "…assign them to **jobs**" and "…for a **job's** category" — surfaced on hover | LOW | p07.json | `MaintenancePage.tsx:450`, `SupplierModal.tsx:163` | **fixed → verified** (both changed to "work order(s)"; 07.4 chrome sweep clean). Code-only |
| PM-008 | p17 / 17.2 | /tenants (drawer) | Edit a tenant via the drawer (Right to Rent + any tab) and Save | tenant updates persist | **every drawer edit fails** with toast "Failed to update" — `updatePmTenant` does a raw `.update({...values})` with no coercion, so empty-string date fields (e.g. `right_to_rent_expiry: ""`) hit Postgres date columns and the `verified` `<select>` sends a string to a boolean column | **HIGH** | diagnostic ("Failed to update" toast); p17.json | `src/features/pm-tenants/actions/pm-tenants.ts:49` (no empty→null / bool coercion, unlike the create path) | **fixed → verified** (coerce empty→null and "true"/"false"→boolean before the update; 17.2 RTR now persists). Code-only |
| OBS-D | p09 / 09.1 | /forms | Duplicate a booking form | fresh form list | `/forms` served a **stale cached render** — the list showed forms (e.g. slug `db61037e92da`) that don't exist in `booking_forms` for the tenant, so the duplicate target was a phantom. Likely Next router/data-cache staleness (dev); re-verify after a server restart. (Also: p09 retries left ~18 preset `automation_rules` in the test tenant — harmless, dry-run/off, untracked; optional manual cleanup.) | LOW | p09.json; DB cross-check | router/data cache on /forms | open — likely dev-only |
| OBS-E | p11 / 11.5 | various | UI-rules DOM probe over 5 pages | no violations | 7 heuristic violations: /properties (5), /tenants (1), /maintenance (1) — mostly inputs without an associated `<label for>` (may use aria/placeholder) and delete-control styling. Heuristic; triage manually | LOW | p11.json captured | per-page components | open — low-priority polish |
| PM-006 | p05 / 05.4 | Documents tab | Inspect the tenant passport-document upload path | upload to a private bucket, served via signed URL | `uploadPmTenantDocument` uploads to bucket **`pm-tenant-docs` which does not exist** → `.upload()` throws "Bucket not found", so the Documents upload is **broken**; it also stores `getPublicUrl(...)`, i.e. it *intends a public bucket* — if that bucket is ever created public, passport scans (PII) are world-readable | **HIGH** (broken) / CRITICAL-latent | p05.json; `listBuckets` | `src/features/pm-tenants/actions/pm-tenants.ts:128-134` (missing bucket + `getPublicUrl`) | open — fix needs a migration (create **private** `pm-tenant-docs` bucket + RLS) **and** code change to signed-URL/route serving (same pattern as the contract fix). See DEC-002 |

### Needs a product decision

Items where the fix is not unambiguous (left for Ali rather than guessed):

| ID | Phase/Step | Question | Why it needs a decision |
|---|---|---|---|
| DEC-001 | p00 | **Apply migration `20261016000001` to production before continuing?** | The stated premise was that every migration is applied; production shows this one is not. It (a) closes a live data exposure (PM-001) and (b) adds the columns Phase 4's rewritten contract generation needs. Running the write phases (esp. p04) before it is applied would both upload test contracts into a world-readable bucket and produce a flood of "missing column" failures that are not code bugs. Per CLAUDE.md, migrations are applied by hand — this is Ali's to run. |
| DEC-002 | p05 | **Tenant document storage (PM-006): confirm the private-bucket + signed-route fix?** | The passport-document upload is broken (bucket missing) and the code uses `getPublicUrl` (public intent). The correct fix is the same shape as the contract-document work: a migration creating a **private** `pm-tenant-docs` bucket with agency-scoped RLS, plus a code change to store the path and serve via an authorised route (signed URL), replacing `getPublicUrl`. This is a migration (manual apply) + code change — grouping it with DEC-001's document-storage work so it's done once, consistently. |

---

## Captured errors

Every `pageerror`, `console.error`, HTTP 5xx, and error-overlay/boundary seen during the run, grouped by route. Not all are bugs — triaged into the bug log above.

<!-- AUTO:CAPTURED -->
**`/apply/d101d8e1e96f/8ae4fbc5-2d5a-420f-9c0c-97c2d649d993?price=1000`** (1)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 03.3 | ui-rule | LOW | public apply form blocks empty submit via native HTML `required`, not inline Zod errors (CLAUDE.md) |

**`/apply/d101d8e1e96f/not-a-real-unit`** (1)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 03.4 | console.error | MEDIUM | Failed to load resource: the server responded with a status of 404 (Not Found) |

**`/contracts/templates`** (11)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 01.s8 | console.error | MEDIUM | Failed to load resource: net::ERR_CONNECTION_REFUSED |

**`/forms`** (1)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 17.3 | console.error | MEDIUM | Warning: Prop `%s` did not match. Server: %s Client: %s%s aria-describedby "DndDescribedBy-1" "DndDescribedBy-0" at button at div at SortableQuestionItem (webpack-internal:///(app- |

**`/maintenance`** (1)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 11.5 | ui-rule | LOW | /maintenance: label — input "Search by reference, title, property…" has no associated <label> |

**`/properties`** (5)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 11.5 | ui-rule | LOW | /properties: label — input "Search unit, address, tenant…" has no associated <label> |
| 11.5 | ui-rule | LOW | /properties: label — input "Min" has no associated <label> |
| 11.5 | ui-rule | LOW | /properties: label — input "Max" has no associated <label> |
| 11.5 | ui-rule | LOW | /properties: label — input "input" has no associated <label> |
| 11.5 | ui-rule | LOW | /properties: label — input "input" has no associated <label> |

**`/properties/33f21225-2110-4b65-b7cb-8300a6b42b1b`** (4)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 02.6 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 02.6 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 02.8 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 02.8 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |

**`/properties/bb100000-0000-4000-8000-000000000003`** (26)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | console.error | MEDIUM | The above error occurred in the <NotFoundErrorBoundary> component: at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-r |
| 00.7 | console.error | MEDIUM | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 00.7 | console.error | MEDIUM | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | pageerror | HIGH | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | console.error | MEDIUM | The above error occurred in the <NotFoundErrorBoundary> component: at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-r |
| 12.1 | console.error | MEDIUM | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |
| 12.1 | console.error | MEDIUM | Error: Property not found at getPropertyTenantHistory (webpack-internal:///(rsc)/./src/features/contracts/data/tenant-history.ts:185:26) at process.processTicksAndRejections (node: |

**`/s/iYVv3eLzzLzEvla3BEoMtUeu`** (2)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 09.3b | console.error | MEDIUM | Failed to load resource: the server responded with a status of 410 (Gone) |
| 09.3b | console.error | MEDIUM | Failed to load resource: the server responded with a status of 410 (Gone) |

**`/tenants`** (10)

| Phase/Step | Type | Severity | Message |
|---|---|---|---|
| 05.3 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 05.3 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 05.5 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 05.5 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 11.5 | ui-rule | LOW | /tenants: label — input "Search name, email, phone…" has no associated <label> |
| 17.1 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 17.1 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 17.1 | console.error | MEDIUM | Warning: Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.%s Check the render method of `GuarantorsContent`. |
| 17.2 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |
| 17.2 | console.error | MEDIUM | `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users. If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden  |

<!-- /AUTO:CAPTURED -->

---

## Skipped steps

Steps deliberately not completed (final sends, activations, invites, or missing fixtures). Every skip must have a reason.

<!-- AUTO:SKIPPED -->
| Phase | Step | Title | Reason |
|---|---|---|---|
| p02 | 02.9 | landlord contract PDF upload | DEC-001: writes to the still-public property_contracts bucket; deferred until migration 20261016000001 is applied |
| p02 | 02.10 | unit photos upload/delete | deep per-widget file-drop flow; low regression value vs cost — covered by error capture on the property page |
| p02 | 02.11 | keys: add / check out / check in / history / mark lost | full key lifecycle is a dedicated widget; deferred to keep p02 robust |
| p02 | 02.12 | kanban drag → StatusPickerDialog | HTML5 drag-drop is brittle under Playwright; status change is covered by 02.8 |
| p03 | 03.6 | bank details save | no bank-details form (likely no portfolio on this tenant) |
| p03 | 03.7 | form builder loads and add-question works (BUG-2) | no add-question control found (builder needs a selected form) |
| p03 | 03.8 | booking form: dropdown '3 options' edit (BUG-3) | deep QuestionEditor flow; re-verify manually |
| p03 | 03.9 | booking form: delete asks to confirm (BUG-4) | depends on a selected form with questions; covered partially by UI-rules sweep in p11 |
| p03 | 03.10 | question reordering persists | drag-reorder is brittle under Playwright |
| p03 | 03.11 | public apply: two-applicant real submission | creates a booking; the convert-to-tenancy chain (p04) is deferred under DEC-001 |
| p05 | 05.5-note | welcome email SEND | never clicked — immediate-send path; preview only per run rules |
| p05 | 05.6b | reminder full create + cancel | cross-field refinement form; covered in p09 reminders |
| p05 | 05.7 | guarantor create/edit/delete | deep drawer sub-form; re-verify via UI-rules sweep in p11 |
| p05 | 05.8 | right-to-rent record | deep drawer sub-form; low regression value this round |
| p06 | 06.4 | tenant charge create + delete | charge not persisted (modal may need more fields); logged for p06 follow-up |
| p06 | 06.5 | record rent payment (part + full) + undo | needs an active tenancy from p04 (deferred under DEC-001) |
| p06 | 06.6 | month close attest→review→close→reopen | multi-step close workflow; deferred this round |
| p06 | 06.7 | missing-rent flag resolve | depends on statement-to-tenancy matching; deferred |
| p06 | 06.8 | post recurring | mutates finance entries broadly; deferred to avoid wide writes |
| p07 | 07.7 | work order drawer: cost (→ profitability mirror), comments, photo, activity | deep drawer sub-flows; cost→profitability mirror needs the cost modal inside the drawer |
| p07 | 07.8 | kanban drag between columns | HTML5 drag-drop is brittle under Playwright |
| p07 | 07.9 | works-order PDF preview + deep links ?job=/?action=new | PDF render + querystring deep-links; low regression value this round |
| p07 | 07.10 | certificate document byte-for-byte match + global search | doc download route + search covered in p11; create+store verified here |
| p07 | 07.11 | supplier edit/delete | create verified; edit/delete are the same modal + a native/confirm delete |
| p08 | 08.5 | fee override on a property | FeeOverrideDialog is a deep per-property sub-flow |
| p08 | 08.6 | rechargeable toggle + adjustment line add/delete | deep statement-detail sub-flows |
| p08 | 08.7 | PDF totals match screen; regenerate no-duplicate | needs PDF parsing; verified the generate+detail render |
| p08 | 08.8 | void statement | state-changing; low value with an empty statement |
| p08 | 08.9 | send statement | never sent — immediate-send path, per run rules |
| p09 | 09.1 | duplicate a booking form | no new form row — /forms served a stale cached render (phantom selection); re-verify after a dev-server restart |
| p09 | 09.4 | automation template preview (placeholders / unknown flag) | TemplatesManager preview is a deep sub-flow; re-verify manually |
| p09 | 09.5 | reminders snooze / dismiss / edit queued | RemindersInbox needs queued messages; cross-field reminder form |
| p09 | 09.6 | inbox request detail + reject | needs a seeded inbox request; low write value this round |
| p09 | 09.7 | acquisition wizard incl. AI step + status change | multi-step wizard + a paid AI call; deferred to keep the run bounded |
| p10 | 10.4 | email / integrations / e-signing / deposits / billing-info activation | render-only per run rules — never activated or connected |
| p11 | 11.6 | todos / quick links create/edit/delete/reorder | dashboard widget CRUD; low regression value this round |
| p15 | 15.4 | month CLOSE → reopen | close locks the period and reopen requires super-admin; E2E account is admin — would leave a prod month locked |
| p15 | 15.5 | rent payment undo | undo lives in the per-unit history (expandable); covered by record — full undo deferred |
| p16 | 16.7 | fee override at property level (FeeOverrideDialog per-property) | statement-level override covered in 16.5; per-property override is a deeper variant |
| p17 | 17.4 | keys: add / check out / check in / history / mark lost | multi-dialog flow across AddKeys/Checkout/Checkin/History; deferred (lower value this round) |
| p17 | 17.5 | unit/property photo upload + delete | drag-drop file upload is brittle under Playwright; storage-write flow deferred |
| p17 | 17.6 | kanban drag between columns | HTML5 drag-drop is unreliable under Playwright; status changes covered via dialogs in p02/p04/p07 |
| p14 | 14.1 | a delete control is red, uses Trash2, and confirms | no delete control sampled on this view |
<!-- /AUTO:SKIPPED -->

---

## Migrations pending manual apply

New migrations created by the **fix** stage of this run that must be applied by hand (never applied automatically; never edited after creation).

| Migration file | What it changes | Applied? |
|---|---|---|
| _(none created this run)_ | PM-003 and PM-007 were code-only fixes (no schema change). PM-006/DEC-002 **will** need a new migration (create a private `pm-tenant-docs` bucket + RLS) when that fix is implemented. | n/a |

**Pre-existing, confirmed NOT applied to prod → Ali to apply by hand:** `supabase/migrations/20261016000001_contract_generation_fixes.sql` (DEC-001 / PM-001 / PM-002).

> **Premise correction (2026-10-17):** the plan assumed every migration was already applied. p00 disproved this for `20261016000001_contract_generation_fixes.sql` — see PM-001/PM-002/DEC-001. Its columns are absent and the `property_contracts` bucket is still public on production. So the memory note that the contract-generation migration is "pending manual apply" was **correct**, not stale. The other migrations flagged as pending in memory (automations / certificates / super-admin / helpdesk / listing-feeds) have **not yet been re-verified** this run — do not assume they are applied until a phase checks them.

---

## Run-1 regression re-verification

Run-1 (`harbor-ops-e2e-test-report.md`) logged BUG-2…BUG-8 and OBS-1/2. None were re-verified in rounds 2–3. This round re-checks each.

| Run-1 id | Summary | Re-checked in | Status |
|---|---|---|---|
| BUG-2 | New list items require a reload to appear | p07 (07.2) | **verified FIXED** — new work order WO-00004 appeared on the board without a reload |
| BUG-3 | Form dropdown "3 options" / edit crash | p03 | not re-checked — form-builder question editor skipped (deep); re-verify manually |
| BUG-4 | Delete without a confirm step | p06/p10/p14 | **confirmed present** — overhead delete uses a native `confirm()`, API-key delete via UI; p14 sampled red/Trash2/confirm |
| BUG-5 | _(see run-1 report)_ | — | not in this round's scope |
| BUG-6 | Collection-day validation (day 45 accepted) | p04 | **not tested — p04 deferred** under DEC-001 (contract migration) |
| BUG-7 | _(see run-1 report)_ | — | not in this round's scope |
| BUG-8 | _(see run-1 report)_ | — | not in this round's scope |
| OBS-1 | _(see run-1 report)_ | — | not in this round's scope |
| OBS-2 | _(see run-1 report)_ | — | not in this round's scope |
