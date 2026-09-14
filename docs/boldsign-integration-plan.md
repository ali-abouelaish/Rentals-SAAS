# BoldSign e-Signing Integration Plan

**Status:** PHASE 0 COMPLETE (discovery only — no production code changed). Awaiting review before Phase 1.
**Provider:** BoldSign, EU region (`https://api-eu.boldsign.com`), Enterprise API tier in production.
**Prior art:** `src/lib/dps/` (integration layout), `src/app/api/webhooks/resend/route.ts` (HMAC-verified webhook).

---

## 0. Phase 0 findings

### 0.1 Stack

Next.js 14 App Router, TypeScript strict, **Supabase/PostgreSQL** — not MySQL, not Laravel or Express. Self-hosted VPS + PM2; background work runs in-process via node-cron from `src/instrumentation.ts`.

Conventions to follow:

- **Layout:** `src/lib/<provider>/` for the API layer, `src/features/<provider>/` for actions/data/domain/ui.
- **Secrets:** read from `process.env` inside functions, never at module top level.
- **Multi-tenancy:** `tenant_id` on every table, RLS enforced in the DB; service role only via `createSupabaseAdminClient()`.
- **Migrations:** timestamped files in `supabase/migrations/`, applied by hand (Supabase MCP is read-only).
- **Verification:** `npx tsc --noEmit` + `npm run build`. There is no test runner, and `npm run lint` hangs (no ESLint config).

**Correction to the brief:** it assumes MySQL and gives Laravel/Express raw-body advice. Neither applies — see §0.3.

### 0.2 Models signing attaches to

| Document | Table | Status today | Source PDF today |
|---|---|---|---|
| AST tenancy | `property_contracts` | `draft`/`sent`/`signed`/`active`/`notice_given`/`terminated`; also `signing_method`, `generated_pdf_path` | **Yes** — pdf-lib template stamping into the private `property-contracts` bucket |
| Works order | `maintenance_jobs` | `open`/`in_progress`/`pending_parts`/`pending_quote`/`resolved`/`closed`; `reference` = `WO-00042` | **No — nothing generates one.** Phase 2 must build the document first |
| Owner statement | `owner_statements` | `draft`/`approved`/`sent`/`void` | **Yes** — `@react-pdf/renderer` |

**Data model:** keep the signing lifecycle in a new `boldsign_documents` table (`tenant_id`, `entity_type`, `entity_id`, `boldsign_document_id` unique, `brand_id`, `status`, `signed_pdf_path`, `audit_trail_path`) plus `boldsign_document_events` for idempotency. Mirror only a coarse transition back onto the host record (`property_contracts.status` → `signed` on `Completed`).

Rationale: the brief's `awaiting_signature`/`partially_signed`/`executed` vocabulary would otherwise have to be added to three separate CHECK constraints, each driving its own kanban, badges and filters.

Also needed: a migration adding `'boldsign'` to the `property_contracts.signing_method` CHECK, and a private `signed-documents` bucket with RLS policies.

**Vocabulary:** user-facing copy says "work order", never "job".

### 0.3 Webhooks

The raw-body trap the brief warns about doesn't exist here. App Router route handlers get the untouched `Request` — no global body parser, no CSRF middleware — and `await request.text()` returns the exact bytes. `src/app/api/webhooks/resend/route.ts:37` already does this. The rule still holds: verify the raw text, never a re-serialised object.

- `src/middleware.ts:154` short-circuits all `/api/` paths out of the auth redirect, so the endpoint is reachable already. Add it to `PUBLIC_PATHS` anyway so a later middleware edit can't silently break delivery.
- Needs `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- Persist the verified event before processing, so a handler failure can be replayed.

### 0.4 SDK

**Use the official `boldsign` SDK** (npm v3.3.4, MIT). It covers the risky parts of this integration directly:

- `WebhookUtility.validateSignature()` — the HMAC is `HMAC-SHA256(secret, "{timestamp}.{payload}")`, hex, lowercased, with timestamp tolerance and `s0`/`s1` rotation handled.
- `SendForSign` types the fields the later phases need: `useTextTags`/`textTagDefinitions` (Phase 2), `brandId`/`onBehalfOf` (Phase 5), and `metaData`, which is echoed back on the webhook event and gives free correlation to the Harbor Ops record.
- `downloadDocument()` / `downloadAuditLog()` return `Buffer` — Phase 4's two artefacts.

**One thing to get right:** every API class hard-codes `defaultBasePath = 'https://api.boldsign.com'` (US) and takes the host only via its constructor. Construct all of them through a single factory in `src/lib/boldsign/client.ts` that passes the EU host, so no call site can omit it and leave the EU. Verified at runtime — `new DocumentApi().basePath` really does return the US host.

Two gotchas confirmed by inspecting the installed package:

- **`WebhookUtility` is not exported from the package entry point.** `boldsign`'s `dist/api.d.ts` re-exports only `./api/index` and `./model/index`. It needs a deep import — `boldsign/dist/WebhookUtility` — which works because the package declares no `exports` map. Phase 3 should wrap this in our own module so the deep path appears exactly once.
- Wrap `validateSignature()` in try/catch — it throws a `RangeError` on a length-mismatched signature rather than returning false.

### 0.5 Repo requirements the brief doesn't cover

1. **Entitlement** — an `e_signing` `FeatureKey`, a migration inserting `tenant_feature_entitlements` rows, and a super-admin toggle (per `CLAUDE.md`). **DONE 2026-09-09, and differently — see §7.** E-signing is sold as a paid integration, so it is granted by a subscription rather than a blanket entitlement grant.
2. **New page checklist** — tooltips, a help article registered in `src/features/help/content/registry.ts`, and a `SearchResultKind` + `global_search` migration if it surfaces a searchable entity.
3. **Test runner** — Phase 6 needs one; `node --test` adds no dependencies.
4. **Phase 5** — the super-admin credential pattern exists at `src/app/(app)/admin/deposit-schemes/`. On Enterprise this is likely one platform `BOLDSIGN_API_KEY` plus a `boldsign_brand_id` per tenant, so no per-agency secret encryption is needed.

---

## 1. Configuration and API client — DONE

`boldsign@3.3.4` installed (adds 16 packages; introduces no new audit findings — the 6 pre-existing highs are `next`, `postcss`, `xlsx`, `undici`, `nanoid`, `brace-expansion`).

| File | Purpose |
|---|---|
| `src/lib/boldsign/config.ts` | Env access. `boldSignHost()` (EU default), `boldSignEnv()` (sandbox default), `boldSignApiKey()`, `boldSignWebhookSecret()`, `isBoldSignConfigured()`. All read at call time, never at module load. |
| `src/lib/boldsign/client.ts` | The single chokepoint. `createApi()` pins the host and API key; `documentApi()` / `templateApi()` / `brandingApi()` / `senderIdentitiesApi()` are the only constructors. Plus `boldSignErrorMessage()` and `boldSignHealthCheck()`. `import "server-only"` keeps the key off the client. |
| `scripts/boldsign-probe.mjs` | `npm run boldsign:probe` — standalone credential check via raw `fetch`, so it tests the key and host independently of our wrapper. |

Env vars documented in `.env.example` and the `CLAUDE.md` table: `BOLDSIGN_API_KEY`, `BOLDSIGN_HOST`, `BOLDSIGN_ENV`, `BOLDSIGN_WEBHOOK_SECRET`. Nothing is hard-coded and no key is in source control.

**Deviation from the brief:** it asked for a `BoldSignService` class. This is a module of functions instead, matching the existing integration layer (`src/lib/dps/apiClient.ts`, `src/lib/tds/apiClient.ts`). It serves the same purpose — one chokepoint — without importing a class-based style the codebase doesn't use.

**Verified:** `npx tsc --noEmit` clean, `npm run build` clean.

**Acceptance met 2026-08-27** with a real sandbox key:

- `npm run boldsign:probe` → `PASS — HTTP 200`, authenticated against `https://api-eu.boldsign.com`, 0 documents on the fresh account, exit 0. An invalid key gives a clean `HTTP 401` and exit 1.
- The SDK path was exercised separately (`new DocumentApi(EU_HOST).listDocuments(1, …, 1)`) to prove the positional signature and the response shape: `pageDetails.totalRecordsCount` is the correct field, `result` is an array.
- The key lives only in `.env.local` (gitignored); source control holds empty placeholders.

## 2. Templates and the send flow — IN PROGRESS

### 2.1 DECIDED: generated PDFs + coordinate fields, not BoldSign templates

**Ali confirmed 2026-08-28: always use the agencies' own Harbor Ops templates.** The reasoning below stands as the record of why.

The brief says to register each document type as a reusable BoldSign template. That does not fit this codebase, for two reasons:

1. **Harbor Ops already is the template system.** `contract_templates` / `contract_template_fields` let each agency upload *their own* AST and place merge fields visually in `TemplateEditor.tsx`; `stampContractPdf` burns the values in with pdf-lib. Templates are per-agency, not one shared document, so "register the AST as a BoldSign template" would mean one BoldSign template per agency per document — duplicating a system that already exists and that agencies already use.
2. **The brief's rationale for text tags doesn't hold here.** It prefers text tags to avoid hard-coded x/y coordinates. But these coordinates aren't hard-coded — they're placed visually by the agency and stored per template, in points with a **top-left origin**, which is exactly the shape BoldSign's `FormField.bounds` takes.

So: generate the PDF as today, then send that file with per-signer coordinate `formFields`. A signature box becomes just another field type in the editor agencies already know. Verified available: `FieldTypeEnum` includes `Signature`, `Initial` and `DateSigned`.

**Open: the coordinate origin is unconfirmed.** BoldSign echoes back whatever `bounds` you send, so the API can't settle whether y is measured from the top or the bottom of the page. `npm run boldsign:send-probe` sends a document with "TOP MARKER"/"BOTTOM MARKER" text and a signature box at y=90; whichever marker the box lands next to gives the answer. If it's bottom-left, the flip is `y_boldsign = pageHeight - y_harborops - height`, applied in one place.

### 2.2 Built

| File | Purpose |
|---|---|
| `supabase/migrations/20260827000001_boldsign_documents.sql` | `boldsign_documents` + `boldsign_document_events`, RLS, and the private `signed_documents` bucket. |
| `supabase/migrations/20260827000002_contracts_boldsign_signing_method.sql` | Adds `'boldsign'` to the `property_contracts.signing_method` CHECK. |
| `src/lib/boldsign/types.ts` | Harbor Ops' own vocabulary — entity types, statuses, field specs. The app never sees SDK models. |
| `src/lib/boldsign/send.ts` | `sendForSignature()`. |
| `scripts/boldsign-send-probe.mjs` | `npm run boldsign:send-probe` — proves the send contract without emailing anyone. |

**Reserve → send → confirm.** The `boldsign_documents` row is inserted *before* the BoldSign call, with a null document id, to claim the one-active-per-entity unique index; the id is written back after. Sending first would let two concurrent clicks both raise real documents and email a tenant two copies of the same agreement, detecting the collision only afterwards. This is why `boldsign_document_id` is nullable with a partial unique index rather than `not null unique`.

### 2.3 Verified against the sandbox

`npm run boldsign:send-probe` created document `e3a07bec-…` — proving file upload (Buffer → multipart), coordinate form fields, signer construction, `metaData`, `isSandbox` and `disableEmails` all work, and that `sendDocument` returns a `documentId`.

Two findings worth carrying forward:

- **`getProperties` can return 403 immediately after `sendDocument`.** The same call succeeded moments later, and raw REST returned 200 throughout — so this is propagation delay, not a permission problem. Phase 4 must not treat a single 403 on a just-created document as fatal.
- **The account already has a default brand** (`87105448-…`), auto-assigned to documents that don't name one. Phase 5 starts from an existing brand rather than a blank slate.

### 2.4 The works order document — BUILT

Works orders were the one type with nothing to sign. There is now a document.

| File | Purpose |
|---|---|
| `src/features/maintenance/pdf/WorksOrderPdf.tsx` | The document, in the house style set by `OwnerStatementPdf`. |
| `src/features/maintenance/domain/worksOrderFields.ts` | Signature geometry — **the single source of truth**. |
| `src/features/maintenance/domain/worksOrderFields.test.ts` | 12 tests over that geometry. |
| `src/features/maintenance/lib/worksOrderPdf.ts` | `buildWorksOrderDocument()` — loads, renders, returns PDF + fields + contractor. |
| `src/app/api/dev-works-order-preview/route.ts` | Dev-only preview with the field rectangles stamped on top. 404s in production. |

**Content:** agency letterhead and brand rule, works order reference and priority, contractor and location cards, the work required (trade, priority, scheduled date, description), a costed table with total, acceptance terms, and the signature block. Falls back gracefully — no contractor assigned, no costs agreed, no unit — rather than rendering blanks.

**One signer: the contractor.** The agency issues the order rather than counter-signing it, so a second signature block would be ceremony without meaning.

**Geometry is the risky part**, because a field placed away from the box the contractor sees fails silently. Two bugs were found and fixed while verifying it:

1. **The block's `bottom` referred to the caption, not the box.** Wrapping box + caption in one positioned container meant the field would have sat ~14pt below the box it was meant to fill. Each box is now positioned absolutely with its own `bottom`, and the captions sit above them — which also matches the app's label-above-field rule.
2. **The page number was hard-coded to 1.** An absolutely-positioned block renders on whichever page the flow reaches. The sample works order — a realistic one, with a paragraph of description and three cost lines — **runs to two pages**, so the field would have been stranded on page 1 away from its box. `buildWorksOrderDocument()` now reads the real page count from the rendered PDF with pdf-lib and places the fields on the last page. Confirmed: the preview reports `pageNumber: 2`.

**Verified:** renders to a valid two-page A4 PDF; `pageNumber` follows the content; 12 geometry tests cover origin conversion, the boxes' left edges matching the stylesheet constants, a shared baseline, both fields inside the page, no overlap, and enough reserved page padding that flowing content cannot collide with the block.

**Left for a human:** open `works-order-with-field-overlay.pdf` (produced by the dev preview route) and confirm the red stamped rectangles sit exactly over the dashed boxes. That is the same kind of 10-second visual check that settled the coordinate origin, and it cannot be done from the API — BoldSign echoes back whatever bounds it is given.

### 2.5 Works orders wired — DONE

The first document type is connected end to end.

| File | Purpose |
|---|---|
| `src/features/maintenance/actions/signing.ts` | `sendWorksOrderForSignature()` and `getWorksOrderSigningState()`. Separate from `actions/index.ts` so the maintenance module doesn't pull BoldSign and react-pdf into every action import. |
| `src/features/maintenance/ui/WorksOrderSigningPanel.tsx` | The panel, under the supplier picker — the assigned contractor is who signs. |
| `src/features/help/content/maintenance.ts` | Chatbot knowledge for the new capability, per the repo's new-feature checklist. |

Behaviour worth noting:

- **Status is loaded when the drawer opens, not passed down.** It changes outside the app — a contractor signing updates it by webhook, with nothing in the UI to trigger a re-render — so stale props would be worse than a fetch.
- **The button is disabled with a reason, not just greyed out.** No contractor email, or a request already in flight, each explain themselves in a tooltip. A disabled button is wrapped in a span so the tooltip still fires; disabled elements emit no pointer events.
- **Terminal states offer "Send again"; in-flight ones don't** — which mirrors the `boldsign_documents` partial unique index rather than duplicating its rules by eye.
- A **Sandbox** badge marks documents that aren't binding.
- Missing agency branding degrades to the account default rather than blocking the send.

### 2.6 Contracts wired — DONE

Agencies can now place signature boxes on their own AST, in the editor they already use, and send it for signature.

| File | Purpose |
|---|---|
| `supabase/migrations/20260828000001_contract_template_signature_fields.sql` | `field_kind` + `signer_role` on `contract_template_fields`. **Not yet applied.** |
| `src/features/contracts/lib/signatureFields.ts` + `.test.ts` | Grouping template fields into signers. 11 tests. |
| `src/features/contracts/actions/signing.ts` | `sendContractForSignature()`, `getContractSigningState()`. |
| `src/features/contracts/ui/ContractSigningPanel.tsx` | The panel, in the drawer's Document tab. |
| `src/components/signing/SigningPanel.tsx` | Shared panel behaviour, now used by both works orders and contracts. |

**A signature is just another field kind on the canvas agencies already use.** `field_kind` distinguishes a merge field (resolved and stamped, as today) from `signature` / `initial` / `date_signed` (left blank and handed to BoldSign at send time). `signer_role` says whose it is — a tenancy has two signatories, so a signature box means nothing without one.

`source` became nullable because a signature binds to no data, with a CHECK keeping each kind honest: data fields still need a source, signature fields still need a signer.

**No coordinate conversion.** `contract_template_fields` already stores PDF points with a top-left origin, which is exactly BoldSign's `bounds`. Only the page index shifts — the editor is 0-based, BoldSign is 1-based.

**Signing order is enforced**: tenant, then landlord countersigning. The landlord signs what the tenant has already signed, rather than both signing a half-executed document.

**Guarantor is in the schema but not offered in the editor.** Harbor Ops has no guarantor record, so there would be no address to send to — offering the option and then failing at send time is worse than not offering it. When a guarantor contact exists, only the dropdown needs to change.

**Pre-migration safety.** Migrations are applied by hand, so there is a window where the code is deployed and the column is not. Reading `field_kind` as undefined would have made the stamper skip **every** field and generate blank contracts, and would have shown phantom signature boxes on every merge field. All three read sites default a missing value to `"data"`, and a test pins that behaviour.

Errors name the fix rather than the symptom: no generated document, no signature fields on the template, a tenant with no email, a landlord with no email — each says what to do.

**Confirmed working by Ali, 2026-08-28** — a contract generated from a template with signature fields sends to the tenant. First real end-to-end use of `sendForSignature()`.

### 2.7 Not done

- **Owner statements are not wired.** Simplest of the three: we control that layout, so the works order's one-source-of-truth geometry approach applies directly.
- Migrations `20260827000001`–`3` are applied. **`20260828000001` is not** — apply it before using contract signature fields.

## 3. Webhook endpoint with HMAC verification — DONE

| File | Purpose |
|---|---|
| `src/lib/boldsign/webhook.ts` | `verifyBoldSignSignature()`. Pure — secret and clock are arguments, no env reads, no `server-only` — so it is directly unit-testable. |
| `src/lib/boldsign/webhook.test.ts` | 23 tests. |
| `src/app/api/webhooks/boldsign/route.ts` | The endpoint. Raw body → verify → parse → record. |
| `src/middleware.ts` | `/api/webhooks` added to `PUBLIC_PATHS`. |

**The scheme**, read out of the SDK's `WebhookUtility` because BoldSign's written docs don't state it: header `X-BoldSign-Signature: t=<unix-seconds>,s0=<hex>[,s1=<hex>]`, expected value `HMAC-SHA256(secret, "{timestamp}.{rawBody}")` as lowercase hex, 300-second tolerance, `s1` present during secret rotation. **The `.` separator is load-bearing** and is pinned by a test.

**Reimplemented rather than delegating** to `WebhookUtility.validateSignature()`: it isn't exported from the package entry (needs a deep import into `boldsign/dist/`), and it calls `timingSafeEqual` on unequal-length buffers, which throws `RangeError` instead of returning false — so a malformed forgery would surface as a 500 rather than a clean rejection. Confirmed against the installed SDK, and covered by a cross-compatibility test proving our signatures are accepted by their validator (so an SDK update changing the scheme would fail our suite).

### Test runner

`npm test` → `node --test "src/**/*.test.ts"`. Node 24's native type stripping runs the TypeScript directly, so **no test framework or transpiler was added**. This required `allowImportingTsExtensions` in `tsconfig.json`, because Node needs the explicit `.ts` in the import path. This is the runner Phase 6 needs.

### Verified

- **23/23 unit tests pass**, covering: the exact HMAC construction, tampered body, re-serialised body (`JSON.stringify(JSON.parse(body))` — the trap the module exists to prevent), wrong secret, replayed timestamp, short signature, missing/malformed headers, tolerance boundaries either side, `s1` rotation, and empty body.
- **11/11 live-route checks pass** against a running dev server: valid → 200; redelivery → 200 with `duplicate: true`; tampered, unsigned, wrong-secret, stale-timestamp and malformed-header → 401; rotated `s1` → 200; `Verification` event → 200 in 31 ms (budget is 10 s).
- Database confirmed afterwards: exactly the two accepted non-verification events were stored with `processed_at` null; the duplicate, the `Verification` event and every rejected payload stored nothing. Test rows were deleted afterwards.
- `npx tsc --noEmit` clean, `npm run build` clean, `/api/webhooks/boldsign` registered as a dynamic route.

### Outstanding

- `BOLDSIGN_WEBHOOK_SECRET` must be generated in the BoldSign app and set in the environment (the live test used a locally-set secret).
- The URL must be registered in the BoldSign app against a public HTTPS host; local testing needs a tunnel.

## 4. Event handling and data model — DONE

| File | Purpose |
|---|---|
| `src/lib/boldsign/statusMap.ts` | Event → status, plus the out-of-order rules. Pure, so it is unit-tested. |
| `src/lib/boldsign/artifacts.ts` | Downloads the signed PDF + audit trail on completion and stores them in the private `signed_documents` bucket. |
| `src/lib/boldsign/events.ts` | `processBoldSignEvent()` — applies the status and mirrors onto the host record. |
| `src/lib/boldsign/statusMap.test.ts` | 12 tests. |

Events handled: `Sent` → `awaiting_signature`, `Signed` → `partially_signed`, `Completed` → `completed`, `Declined`, `Expired`, `Revoked`, `SendFailed` → `failed`. Everything else (`Viewed`, `Reassigned`, `Reminder`, …) is recorded but carries no status change, and an unrecognised future event type returns null rather than throwing.

### Idempotency, in three layers

1. `boldsign_document_events.event_id` is unique — a redelivery cannot create a second row.
2. Processing is **assignment, not mutation**: it sets the status the event implies rather than advancing a state machine, so running it twice lands in the same place.
3. **Terminal statuses are sticky.** Webhooks are not ordered, so a delayed `Signed` can arrive after the `Completed` that followed it; without this rule that would walk an executed agreement back to partially signed. The one permitted repeat is the same terminal status, so a redelivered `Completed` can retry an artefact download that failed the first time.

A redelivery whose *first* delivery failed processing is retried rather than acked, by checking `processed_at` on the existing row.

### Host record mirroring

Only contracts, and only on completion: `property_contracts.status` → `signed`, `signing_method` → `boldsign`. The other two are deliberately not mirrored — `maintenance_jobs` has no signing-related status (`resolved` means the work is done, which a signature doesn't establish), and `owner_statements.status` uses `approved` to mean *internally* approved before sending, so reusing it would overload an existing meaning. Both keep their signing state in `boldsign_documents`. Inventing states for them is a product decision, not an integration one.

### Verified against the sandbox

- **35/35 unit tests pass** (23 webhook + 12 status map).
- **15/15 live assertions** against a running server: `Signed` → `partially_signed`; redelivery deduped; `Viewed` → no status change; `Declined`/`Expired`/`Revoked` applied; a late `Signed` after `Declined` returned `ignored` with the status unchanged; an event for an unknown document acked without error.
- `downloadDocument` returns a genuine `%PDF-` Buffer (3618 bytes for the probe document).
- **The `Completed` failure path was exercised for real.** Against an unsigned document the audit trail 403s, the three retries fired, and the handler correctly returned 500 *without* recording completion — the document stayed `awaiting_signature` rather than being marked executed with a missing audit trail.
- All test rows were deleted afterwards; both tables are empty.

### Two SDK traps found and handled

- **`downloadAuditLog` 403s until the document is actually completed** (verified). This is why `storeSignedArtifacts` is only ever called from the `Completed` handler.
- **Error bodies on the download endpoints arrive as raw bytes.** Because those endpoints use `responseType: "arraybuffer"`, so does their error response: `err.body` is a Buffer holding `{"error":"Forbidden"}`, `err.body.error` is `undefined`, and the SDK's own `err.message` is a JSON dump of the byte array. `boldSignErrorMessage()` now decodes it — without that, `process_error` in the database read as an unreadable wall of numbers.

### Outstanding

- The **happy path for `Completed` is unproven**: it needs a document that has actually been signed, which requires a human to open the signing link. Everything up to the download is verified; what remains untested is whether `downloadAuditLog` succeeds post-completion.
- The event subscriptions must be enabled in the BoldSign app for the events above.

## 5. Multi-agency layer — DONE 2026-09-12 (Enterprise plan unblocked it)

### 5.1 The blocker

**The BoldSign account allows exactly one brand.** Creating a second returns HTTP 400:

> Your account has reached the limit for the number of brands that can be created. Please consider upgrading to a higher-level plan to create more brands.

`brandList` confirms it: one brand on the account, the default "BoldSign" one. Per-agency branding — the mechanism the brief specifies — cannot work on the current plan, and this is commercial, not technical.

**Sender identities are creatable on the same account** (verified: created one and deleted it immediately). That is the mechanism that works today, and it matches the brief's own note that sender identities are unlimited on the Enterprise tier.

| | Brand | Sender identity |
|---|---|---|
| What the recipient sees | Agency logo, colours, email display name, disclaimer | Agency's actual From address |
| Available on this account | **No — limit reached** | **Yes** |
| Onboarding friction | None; applies immediately | Each agency must verify its mailbox with BoldSign |
| Per-agency seat cost | None | None on Enterprise |

**Decision needed:** upgrade to a plan that includes a brand per agency, or put agencies on the sender-identity path and accept a per-agency mailbox verification step. Note the second choice means BoldSign emails each agency a verification link, so provisioning becomes an outward-facing action that shouldn't be triggered without the agency knowing — which is what the consent columns are for.

### 5.2 Built

| File | Purpose |
|---|---|
| `supabase/migrations/20260827000003_boldsign_agency_brands.sql` | `boldsign_agency_brands` — the tenant → identity mapping. **Not yet applied.** |
| `src/lib/boldsign/brands.ts` | `resolveAgencyIdentity()`, `syncAgencyBrand()`, `recordBrandConsent()`. |
| `src/lib/boldsign/errors.ts` + `errors.test.ts` | Error flattening, extracted and tested (see §5.4). |
| `scripts/boldsign-brand-probe.mjs` | `npm run boldsign:brand-probe` — two agencies, two brands, two documents. |

The schema supports **both** mechanisms, so the decision above stays a configuration choice rather than another migration. A CHECK requires at least one of `brand_id` / `sender_identity_email`, since a row with neither behaves exactly like no row.

Brand content is not stored twice: it derives from the agency's existing Harbor Ops branding via `loadAgencyBrand()`, so an agency changes its logo in one place. The snapshot columns exist only to detect drift and skip no-op syncs.

Resolution at send time is **deliberately forgiving** — an unprovisioned agency, or a failed lookup, sends under the account default rather than being blocked. Failing to send a tenancy agreement is worse than sending one with generic branding. An unverified sender identity is treated as absent, because sending on behalf of one would be rejected outright.

### 5.3 Completed 2026-09-12

**Ali is taking the Enterprise plan**, which settles §5.1: brands are the primary mechanism, sender identities the optional extra. Both are now built and reachable from the UI.

| File | Purpose |
|---|---|
| `supabase/migrations/20260912000001_boldsign_sender_identity_status.sql` | `sender_identity_status` + `sender_identity_requested_at`. **Not yet applied.** |
| `src/lib/boldsign/senderIdentityStatus.ts` + `.test.ts` | Status interpretation, `canSendOnBehalfOf`, `brandIsStale`. Dependency-free; 16 tests. |
| `src/lib/boldsign/senderIdentity.ts` | Request / refresh / resend / remove, against `SenderIdentitiesApi`. |
| `src/features/integrations/actions/esigning.ts` | Agency-facing actions. |
| `src/features/integrations/ui/SendingIdentityCard.tsx` | The agency's own controls on `/settings/e-signing`. |
| `src/features/integrations/data/adminESigning.ts` + `actions/adminESigning.ts` + `ui/ESigningAgenciesManager.tsx` | The super-admin view. |
| `src/app/(app)/admin/e-signing/page.tsx` | `/admin/e-signing`, in `AdminSectionNav`. |

**Status is stored raw, interpreted defensively.** BoldSign's sender-identity vocabulary is undocumented, so the status string is persisted as returned and mapped at read time. Only an explicitly approved value counts; anything unrecognised is treated as unusable. Guessing permissively means passing `onBehalfOf` for an unapproved identity, which BoldSign rejects — so the failure mode is a tenancy agreement that silently never goes, rather than one that goes unbranded.

**`canSendOnBehalfOf` requires the status AND the timestamp to agree.** Either alone has a real failure: a row can hold an old approval date after BoldSign revoked the identity, and a status refreshed without persisting the timestamp means we never confirmed it ourselves. `resolveAgencyIdentity` now uses this rather than the timestamp alone.

**Drift detection replaced the inline comparison.** `brandIsStale` is shared between `syncAgencyBrand` (skip a no-op sync) and both UIs (show "Branding out of date"), so the question is answered the same way everywhere and is unit-tested once. A removed logo counts as drift — not cosmetic, since BoldSign requires one and a sync attempted in that state fails.

**Who may do what, and why:**

- **Brands** are safe for a super admin to create on an agency's behalf: they change what a document looks like, not who it is from, and they email nobody. `/admin/e-signing` offers this for onboarding and for retrying a failed sync.
- **Consent is not.** `adminSyncAgencyBrandAction` deliberately does NOT record consent — the columns exist to evidence that the *agency* agreed, and a super admin stamping it turns the evidence into a formality. Only the agency's own button records it, and the admin list flags brands carrying no agency consent.
- **Sender identities are agency-only.** Requesting one makes BoldSign email that mailbox a verification link. The admin screen can refresh a status (read-only) but cannot create one.

**A real bug fixed on the way:** `recordBrandConsent` issued an UPDATE against a row that may not exist. An UPDATE matching nothing succeeds and changes nothing, so the caller was told consent had been recorded when no record existed — exactly the wrong thing to be wrong about. It now selects the affected rows and reports when none matched.

**Write-before-call in `requestSenderIdentity`,** mirroring the document reserve-then-send: if the API call succeeded and the write failed, we would have emailed a third party a verification request we hold no record of, and the next attempt would email them again. Writing first means the worst case is a row describing a request that did not happen, which the next refresh clears.

### 5.4 Still to verify against the real account

- The **acceptance criterion** — "Agency A shows A's branding, B shows B's" — needs the Enterprise plan live. `npm run boldsign:brand-probe` is written and will prove it; it currently fails at the second brand with the limit message.
- **Sender-identity status strings are unconfirmed.** `senderIdentityState` maps `Approved`/`Pending`/`Declined` plus synonyms; anything else degrades to `unknown`, which is visible in the UI as "Unknown status". If a real verification produces a different string, add it to the map — the test file is where to pin it.

### 5.5 A real bug this phase exposed

The brand limit first surfaced as `Request failed with status code 400` with no detail. The cause: **the SDK only wraps the status codes each generated method declares — 200, 401, 403 — into `HttpError`. Every other status, including 400, rejects as a raw `AxiosError`** where `body` is undefined and the detail sits in `response.data`.

Since 400 is the normal way a send gets rejected for validation, every such failure would have reached the UI and `process_error` as a bare status code. Error handling now lives in `src/lib/boldsign/errors.ts`, covering all three thrown shapes (HttpError, raw AxiosError, plain Error) plus the Buffer bodies the arraybuffer download endpoints return, with 12 tests over the shapes actually observed against the sandbox.

## 6. Testing and go-live — TESTS DONE, E2E BLOCKED

### 6.1 Automated tests

`npm test` → **74 tests across 12 suites**, run by `node --test` with Node 24's native type stripping. No test framework, no transpiler, no new dependencies.

| Suite | Covers |
|---|---|
| `webhook.test.ts` (23) | HMAC construction, tamper, re-serialised body, wrong secret, replayed timestamp, short signature, malformed headers, tolerance boundaries, `s1` rotation, and cross-compatibility with the SDK's own validator. |
| `statusMap.test.ts` (19) | Event → status for every subscribed event, non-status events, unknown future events, terminal stickiness, and `planEventApplication` including the artefact-retry rules. |
| `errors.test.ts` (12) | All three thrown shapes plus Buffer bodies (see §5.4). |
| `request.test.ts` (20) | Field-type mapping, unflipped coordinates, rounding, signer construction, signing order, expiry, brand/on-behalf, the sandbox flag, correlation metadata, and every validation rule. |

Two refactors made this possible, and both improved the code independently:

- `request.ts` — request building split from `send.ts`, so the mapping decisions are pure and testable while `send.ts` is only the database orchestration.
- `planEventApplication()` in `statusMap.ts` — the Completed-handler decision (apply / ignore / fetch artefacts) separated from its effects, so the rules can be tested without a database.

The **live webhook suite was re-run after the refactor**: 15/15 assertions still pass, so the extraction changed no behaviour.

### 6.2 The go-live switch is env-only — verified

Grepped: every `BOLDSIGN_*` variable is read **only** in `src/lib/boldsign/config.ts`, and the API host appears nowhere else in `src/` except one explanatory comment. Switching environments touches no code.

```
BOLDSIGN_API_KEY=<live key from the BoldSign app>
BOLDSIGN_ENV=live          # defaults to sandbox; must be set deliberately
BOLDSIGN_HOST=             # leave unset to stay on the EU region
BOLDSIGN_WEBHOOK_SECRET=<live webhook secret>
```

`BOLDSIGN_ENV` drives `isSandbox` on every send, so a deployment that forgets it keeps issuing sandbox documents rather than binding agreements — the safe direction to fail.

### 6.3 Go-live checklist

1. **Do not start** until §6.4 is green — no real tenancy goes through live before sandbox e2e passes.
2. Generate a **live API key** in the BoldSign app (max 2 per environment). Confirm the account is on a plan that covers §5.1.
3. Set the four variables above in the production environment. Nothing else changes.
4. Run `npm run boldsign:probe` against production. Expect `PASS — HTTP 200` on `api-eu.boldsign.com`.
5. **Re-register the webhook** in the live environment — `https://<host>/api/webhooks/boldsign` — and complete BoldSign's URL verification. Sandbox and live webhooks are separate registrations; the live secret differs.
6. Subscribe to `Sent`, `Signed`, `Completed`, `Declined`, `Expired`, `Revoked`, `SendFailed`.
7. Apply migrations `20260827000001`–`20260827000003`.
8. Send one document to an internal address, sign it, and confirm the record reaches `completed` with both artefacts in the `signed_documents` bucket.
9. Only then route a real tenancy.

**Rollback** is setting `BOLDSIGN_ENV=sandbox` and restoring the sandbox key — no deploy required.

### 6.4 What is not done

*Rewritten 2026-09-09. The previous text predated §2.4–2.6 and claimed no document type was wired; two of the three now are.*

The brief's first acceptance criterion — **"end-to-end sandbox test for each document type"** — is still not met:

- **Contracts and works orders are wired** (§2.5, §2.6) and a contract has been sent for real.
- **Owner statements are not.** The simplest of the three, since we control that layout.
- **The `Completed` happy path is unproven.** Whether `downloadAuditLog` succeeds once a document is genuinely signed needs a human to open a signing link. Everything up to that point is verified, and `downloadDocument` is confirmed to return a real PDF.
- **The webhook has never run against a public host.** It cannot reach `localhost`, so closing that gap needs `BOLDSIGN_WEBHOOK_SECRET` set and the URL registered against the VPS (or a tunnel). Until then nothing ever reaches `completed`: no signed PDF, no audit trail, and contracts never flip to `signed` on their own.
- **Per-agency branding is blocked on the plan limit** (§5.1) — one brand per account. Decide: upgrade, or the sender-identity path.

## 8. Envelopes — DONE 2026-09-12

Charging a flat monthly fee for unlimited sending exposes us to an agency's volume with no ceiling. Envelopes make the unit of value the same as the unit of cost.

| File | Purpose |
|---|---|
| `supabase/migrations/20260912000002_envelope_balances.sql` | `tenant_envelope_balances`, `tenant_envelope_purchases`, RLS, and the three RPCs. **Not yet applied.** |
| `src/lib/envelopes/packs.ts` + `.test.ts` | Packs, allowance, formatting. 14 tests. |
| `src/lib/envelopes/period.ts` + `.test.ts` | Period and projection rules. Dependency-free. 11 tests. |
| `src/lib/envelopes/balance.ts` | Consume / refund / credit / read. |
| `src/features/integrations/ui/BuyEnvelopesDialog.tsx` | Purchase, from settings or from a blocked send. |
| `src/features/integrations/ui/EnvelopeBalanceCard.tsx` | The balance on `/settings/e-signing`. |

**One envelope per document, not per signer** — the BoldSign/DocuSign convention, so it is what agencies already expect.

**Two pools, and spend takes the allowance first.** The 20/month allowance expires; purchased top-ups do not. Spending the purchased ones while free ones expire at month end would quietly cost the agency money, and they would be right to be annoyed about it.

**Consumption is an RPC, not read-then-write.** Two "Send for signature" clicks landing together would both read a balance of 1 and both decide they could spend it. `SELECT … FOR UPDATE` inside `consume_envelope` serialises them.

**The allowance resets lazily, inside the RPC.** A scheduled job that fails leaves every agency unable to send; a lazy reset cannot drift, because the period is derived from the clock when it is needed. The consequence is that a row read between the 1st and that month's first send still holds last month's exhausted figures — `projectBalance` corrects for it at read time. Without that an agency would see zero on the morning of the 1st and buy envelopes it already had.

**Spent between reserve and send.** Not before: the one-active-per-entity check is free, and charging for a duplicate click about to be rejected would be indefensible. Not after: by then the document is gone and the charge can no longer be refused. Every path that fails after the envelope is taken refunds it to the pool it came from — being billed for a document that never arrived costs far more in trust than the envelope is worth.

**Running out is not a dead end.** `sendForSignature` returns `code: "out_of_envelopes"`, and `SigningPanel` opens the purchase dialog in place rather than showing a toast — then **retries the send** once the purchase completes. Buying was a means to an end; making the user click Send again is a second hurdle after the one they just cleared.

**Credit before recording the purchase.** If the order were reversed and the credit failed, the agency would have a bill and no envelopes. This way the worst case is envelopes nobody was charged for — the right direction to fail, and visible in the balance.

### Outstanding

- **Apply the migration.** Until then `consume_envelope` does not exist, and the RPC error path returns a generic failure — sending is blocked for everyone, which is safe but total.
- **Prices and the allowance are placeholders**: 20/month, packs of 25/100/250 at £25/£80/£175. All in `packs.ts`; pack prices freeze onto the purchase row at sale.
- **Invoicing is built** — see §9. `invoiced_at` now has a writer.

## 7. The paid-integration layer — DONE 2026-09-09

E-signing is the first feature Harbor Ops charges for separately, which needed a gating model the codebase did not have.

**The problem.** `getEntitlements()` defaulted every non-admin feature to ON, and every entitlement migration granted its key to all tenants. Adding `e_signing` that way would have switched e-signing on for every agency on the platform and billed it to nobody — the exact opposite of what a paid feature needs.

| File | Purpose |
|---|---|
| `supabase/migrations/20260909000001_tenant_integration_subscriptions.sql` | `tenant_integration_subscriptions`, RLS, the grandfathering backfill, and the cleanup of the old blanket grants. **Not yet applied.** |
| `src/lib/integrations/catalog.ts` | The catalogue — what exists, what it costs, which `FeatureKey`s it unlocks. Code, not data. |
| `src/lib/integrations/access.ts` + `.test.ts` | The access and billing-date rules. Dependency-free, so `node --test` can load them. 19 tests. |
| `src/lib/integrations/subscriptions.ts` | Data access; wires the catalogue into the pure rules. |
| `src/lib/entitlements/features.ts` | `e_signing` key, and `PAID_FEATURES` — the set that inverts the default. |
| `src/lib/entitlements/getEntitlements.ts` | Three-layer resolution: base → subscriptions → entitlement rows. |
| `src/features/integrations/` | The self-serve page: actions, Zod schemas, cards, activate/cancel dialogs. |
| `src/app/(app)/settings/integrations/page.tsx` | `/settings/integrations`. |
| `src/features/admin/ui/TenantIntegrationsPanel.tsx` | Super-admin view: what a tenant subscribes to and what to invoice. |

**Entitlement rows are applied last, so a super admin still wins.** That is what makes a trial (grant without a subscription) and a revocation for non-payment (disable despite one) both possible. It also meant the blanket `mydeposits`/`tds`/`dps` grant rows had to be deleted in the migration — left alone they would have overridden the subscription layer and made the whole opt-in model a no-op. Only `is_enabled = true` rows are deleted; a `false` row was somebody's decision and still stands.

**Grandfathering is from evidence of use, not from the entitlement.** The entitlement was on for everyone, so it proves nothing. The backfill looks for a connection record or a protected deposit, and gives those tenants a free active subscription. Losing deposit protection mid-tenancy on a statutory obligation is not an acceptable way to launch a billing model.

**No payment is taken.** Activation records the price agreed and bills from the 1st of next month; the super-admin panel is what gets invoiced. Cancellation is end-of-period, for the same reason grandfathering exists.

**Gating is checked in the server action, not only the UI.** `sendContractForSignature` and `sendWorksOrderForSignature` both call `hasFeature("e_signing")` — a server action is a public endpoint, and the panel that hides the button is client code. `hasFeature()` was added alongside `requireFeature()` because the latter calls `notFound()`, which in a server action surfaces as a broken page rather than a message.

### Outstanding

- **Apply the migration.** Until then paid features fall back to off for everyone: `getEntitlements()` swallows the missing-table error rather than taking down every page, which under-grants rather than over-grants.
- **Prices are placeholders** (`monthlyPricePence` in the catalogue): e-signing £29/mo, each deposit scheme £15/mo. They are frozen onto the row at activation, so changing them re-prices only new subscribers.
- **Invoicing is manual** — the super-admin panel shows the monthly total to add. There is no charge ledger and no proration; if either is wanted, that is the next piece.


## 9. The invoice run — DONE 2026-09-13

Everything before this recorded a charge and stopped. A subscription knew its price and its billing start; an envelope purchase knew what it cost and which invoice it belonged on; nothing ever gathered them, and `tenant_envelope_purchases.invoiced_at` had no writer at all.

| File | Purpose |
|---|---|
| `supabase/migrations/20260913000001_platform_invoices.sql` | `tenant_platform_invoices` + `_lines`, RLS, and `invoice_id` on purchases. **Not yet applied.** |
| `src/lib/billing/rates.ts` + `.test.ts` | Periods, line building, totals, `canRegenerate`. Dependency-free; 28 tests. |
| `src/lib/billing/generate.ts` | The run. |
| `src/features/admin/data/billing.ts`, `actions/billing.ts`, `ui/PlatformBillingManager.tsx` | `/admin/billing`. |
| `src/lib/cron/platformInvoices.ts` | `30 6 1 * *`, drafts only. |

**Not `invoices`.** That table is an agency billing its own clients. This is the other direction, and conflating them would have been a mess to unpick later.

**It bills in advance, unlike owner statements.** The run on 1 October gathers charges dated 1 October, because `firstOfNextMonth()` is what stamped both `billing_starts_on` and a purchase's `billing_period`. Owner statements report the month that just ended; these two month-start jobs look similar and mean opposite things, which is why both files say so at the top.

**`canRegenerate` is the rule the module exists for.** Drafts rebuild from source freely; anything issued or paid is never rewritten. Silently changing a bill the agency is holding is how a billing system loses a customer — correcting one is a deliberate void-and-reissue. The status is re-asserted in the UPDATE itself, not just checked beforehand, because an admin could issue it between the read and the write.

**The unique index is partial, `where status <> 'void'`** — found while testing. A plain unique constraint made voiding a dead end: the period could never be regenerated, and the envelope purchases the void released had nowhere to go, since a purchase matches on the `billing_period` stamped at sale and that never changes. Voiding a wrong invoice and raising a corrected one is the normal way to fix a billing mistake, so the schema has to permit it.

**Purchases are claimed after the invoice exists.** A failure then leaves them unbilled and pickable by the next run — the safe direction, since the alternative is a purchase marked billed that appears on no invoice. Rebuilding a draft releases its purchases first, so a rebuild that no longer includes one doesn't strand it.

**Agencies can read their own invoices — except drafts.** A draft is our working copy and may still change; a charge nobody can see is a support ticket waiting to happen. There is no agency write policy at all, so an agency admin cannot void or mark its own bill paid.

### Outstanding

- **Apply the migration.**
- **VAT is zero** (`VAT_RATE_BPS` in `rates.ts`). Set it to 2000 when registered; the rate is stamped per invoice at generation, so history keeps what it was billed at.
- **Nothing is emailed.** Issuing makes an invoice visible to the agency in-app; there is no delivery, no PDF and no payment collection. A PDF would follow `OwnerStatementPdf` closely if wanted.
- **No agency-facing invoice list yet.** The RLS policy allows it; no page reads it.
