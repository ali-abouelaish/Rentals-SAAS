# DPS (Deposit Protection Service) Integration Plan

**Status:** Discovery/planning only — no implementation yet.
**Source docs:** `api docs/DPS/` (Computershare design notes: *Create Tenancy V3.2*, *Mark for Bank Transfer v1.1*, *API FAQs v1.0*).
**Prior art:** `src/lib/mydeposits/` + `src/features/mydeposits/` (platform OAuth, Total Property API) and `src/lib/tds/` + `src/features/tds/` (per-agency static creds, Custodial API).

> **Note on paths:** the task brief referenced `src/lib/integrations/<scheme>/`, but the repo convention is `src/lib/<scheme>/` for the API client layer and `src/features/<scheme>/` for actions/data/domain/ui. This plan follows the actual convention (`src/lib/dps/`, `src/features/dps/`).

---

## 1. What the DPS API actually is

DPS's API surface is **tiny** compared to both existing schemes. Two write-only endpoints plus a token endpoint. No read endpoints, no webhooks, no status polling, no certificate retrieval, no repayment API (explicitly out of scope in both design notes).

### 1.1 Base URLs

| Environment | Host | Notes |
|---|---|---|
| Test (UAT) | `api-uat.depositprotection.com` | **Mock mode**: validates the request, stores nothing, returns a canned response |
| Production | `api.depositprotection.com` | |

Documented paths (both POST, JSON body):

- `/v1.0/tenancy/create` — create a tenancy (deposit registration)
- `/v1.0/tenancy/MarkForBankTransfer` — flip a created tenancy from *Awaiting deposit payment* to *Awaiting bank transfer*
- `/v1.0/connect/token` — OAuth token endpoint (host not explicitly stated; assumed same host — **open question Q3**)

### 1.2 Authentication

OAuth 2.0 **client-credentials** flow:

1. `POST /v1.0/connect/token` with `Authorization: Basic base64(clientId:clientSecret)`, body `grant_type=client_credentials` (`application/x-www-form-urlencoded`).
2. Response is a bearer token valid for **20 minutes**; reuse it for API calls until expiry.
3. API calls send `Authorization: Bearer <token>`, `Content-Type: application/json`.

Credentials are **per agency**: each agency asks its DPS account manager for keys and receives one Client ID plus test and live client secrets by email. There is no software-provider/platform tier (same commercial model as TDS, different transport than TDS's path-embedded keys).

Every request/response carries a `requestId` (GUID) — returned in the header and body on success **and** failure; Computershare support uses it to find the request in their logs. We must persist it.

### 1.3 Endpoint schemas

#### POST /v1.0/tenancy/create

Required fields (per Table 2 of the design note):

| Field | Constraint |
|---|---|
| `AgentLandlordId` | 7-digit number — the agency's DPS account ID |
| `AddressLine1`, `Town`, `PostCode` | Postcode must be a valid **England or Wales** postcode |
| `RentAmount` | 0.01–99,999.99, sterling |
| `RentFrequency` | enum as number: 0 Unknown, 1 Monthly, 2 4-Weekly, 3 Weekly |
| `TenancyStartDate` | Table says `DD/MM/YYYY`; JSON examples use `YYYY-MM-DD` (**open question Q2**) |
| `TenancyLength` | 1–108 **months** |
| `DepositAmount` | 0.01–999,999.99, sterling |
| `DatePaid` | Date tenant paid the deposit; doc says must be **before** tenancy start date (**open question Q10**) |
| `Tenants[]` | 1–10 tenants; each needs `Title`, `FirstName`, `LastName`, and **email or mobile** (at least one) |

Optional: `AddressLine2/3`, `County`, `PropertyType` (enum 1–7: Terraced, Detached, SemiDetached, FlatApartment, Maisonette, Bungalow, StudioBedsit), `FurnishingType` (enum 0–4: NotGiven, Furnished, Unfurnished, PartFurnished, WhiteGoodsOnly), `NumberOfBedrooms` (0–255), `TenancyReference` (3–35 chars, free text), per-tenant phone/`TenantReference`, and a single `RelevantPerson` (someone who paid part/all of the deposit; gets a copy of the certificate, no rights over the deposit).

Cross-field validation DPS enforces (we should mirror in Zod):

- Tenant email must not equal the agent's or another tenant's/relevant person's email; same for mobiles (`Duplication` error).
- GB mobiles: start `07`, exactly 11 digits; country code defaults to GB when omitted; other countries 9–15 digits (Tables 4/5).
- Strings limited to alphanumerics + a documented Latin-1 special-character whitelist (Table 3) — reject/strip anything else (e.g. em-dashes, curly quotes from user input).

**Success response:** the doc's example is literally `"deposit ID": "29933400" }` — malformed JSON with a space in the key (**open question Q1**). The deposit ID is 8 digits (per the MarkForBankTransfer doc's `DepositId` spec).

**Error response (HTTP 400):**

```json
{ "error": { "code": "BadArgument", "message": "…", "target": "Create tenancy",
  "requestId": "…", "details": [ { "field": "Tenants[0].LastName",
  "errors": [ { "code": "Required", "message": "Please enter last name" } ] } ] } }
```

Error codes: `Required`, `LengthCriteria`, `InvalidData`, `InvalidCharacters`, `Duplication`, `BadArgument`. `details[].field` uses dotted paths (`Tenants[0].LastName`) — we can map these back to wizard fields for inline display.

#### POST /v1.0/tenancy/MarkForBankTransfer

| Field | Constraint |
|---|---|
| `DepositId` | 8 chars, numeric; must belong to the authenticated agent and be in state *Awaiting deposit payment* |
| `AllocationReference` | 1–18 alphanumeric |

Success: `{ "requestId": "…", "response": { "paymentReference": "DP82770-38464" } }`.

Purpose: the agency batches several created tenancies under an allocation reference, sends **one** bank transfer, and DPS auto-allocates the money and marks each deposit protected. Which reference (allocation vs payment) goes on the actual bank transfer is not stated (**open question Q14**).

### 1.4 Not in the API (confirmed absent from docs)

- **No status read-back.** After creation, the deposit sits at *Awaiting deposit payment*; after payment it becomes *Protected* — but there is no endpoint to observe either transition. Protection confirmation, DAN/certificate, and repayment all happen in the DPS web portal.
- **No webhooks, no rate limits, no idempotency mechanism documented.**
- Agent transfer and repayment/claims APIs explicitly out of scope.
- The FAQ doc adds nothing technical (Postman setup: No Auth + x-www-form-urlencoded body for the token call).

---

## 2. Comparison with mydeposits and TDS

| Dimension | mydeposits | TDS | **DPS** |
|---|---|---|---|
| Credential model | Platform OAuth app (authorization-code + PKCE), per-tenant tokens + refresh | Per-agency `member_id`/`branch_id`/`api_key` in URL path | **Per-agency** client ID + secret (like TDS commercially), **client-credentials OAuth** (like mydeposits technically, but no browser redirect, no refresh token, no PKCE) |
| Token lifecycle | Long-lived + refresh, encrypted at rest | None (static) | 20-minute bearer token — fetch on demand, cache in memory |
| Endpoints used | Many (Total Property API) | Create + status poll + DPC + repayment | **Two** write-only POSTs |
| Async behaviour | Polling cron (`mydeposits-poll`) | Polling cron (`tds-poll`) for DAN | **None possible** — responses are synchronous; no status endpoint to poll |
| Protection confirmation | Via API | Via API (DAN) | **Manual** — user confirms in DPS portal; we record it locally |
| Certificate | Via API | Via API | Not available via API |
| Sandbox | Real sandbox tenancy | Real sandbox | **Mock-only** (validates, stores nothing) |

Reuse verdict:

- **Credential storage/UI**: clone the TDS pattern (`tds_connections` table + `TdsConnectionsManager` on `src/app/(app)/admin/deposit-schemes/page.tsx`) almost verbatim.
- **Secret encryption**: clone `src/lib/tds/encrypt.ts` with a new `DPS_TOKEN_SECRET` key (keeps each scheme's secrets independently rotatable — established pattern).
- **Token handling**: new, but small. In-memory cache keyed by tenant, `expires_at - 60s` safety margin. We run a single Node process on the VPS (PM2, in-process node-cron per `src/instrumentation.ts`), so an in-memory cache is safe; no DB persistence needed for a 20-minute token.
- **Deposit lifecycle**: simpler than TDS — **no cron job at all**. `tds_deposits`' polling machinery drops out; the state machine is driven only by user actions.
- **UI**: `DepositsHub` already switches per-provider tabs (`mydeposits` | `tds`); add a third. `property_contracts.deposit_scheme` already allows `'dps'` (phase-2 schema anticipated it), so no contract-side migration is needed.

---

## 3. Credential storage — existing pattern fits

Reference: `supabase/migrations/20260628000001_tds_connections.sql`. The TDS table is scheme-specific (columns `member_id`, `branch_id`, `region`, `scheme_type`), so DPS gets its **own table**, not a shared one — consistent with `mydeposits_connections` / `tds_connections` precedent:

```
dps_connections
  tenant_id           uuid PK → tenants(id) on delete cascade
  environment         text check in ('uat','production') default 'uat'
  agent_landlord_id   text        -- 7-digit DPS account id (non-secret)
  client_id           text        -- non-secret identifier
  client_secret       text        -- AES-256-GCM ciphertext {iv}:{ct}:{tag}
  account_label       text
  connected_by        uuid → user_profiles(id) on delete set null
  last_verified_at    timestamptz
  last_error          text
  created_at / updated_at
```

RLS **enabled with no policies** (service-role admin client only), exactly like `tds_connections` — the row holds a secret and is only touched server-side via `createSupabaseAdminClient()`. Reuses the `tds_touch_updated_at()`-style trigger (own copy, repo convention).

Credential **verification** has no read endpoint to ping; the lightest real check is the token call itself — if `/v1.0/connect/token` returns a bearer token, the client ID/secret pair is valid. (It does not validate `agent_landlord_id`; that only fails at create time — worth a UI hint.)

---

## 4. Proposed architecture

### New files

```
src/lib/dps/
  config.ts        # env → base URL map (uat/production), token + endpoint paths
  encrypt.ts       # AES-256-GCM using DPS_TOKEN_SECRET (mirror of tds/encrypt.ts)
  token.ts         # client-credentials token fetch + in-memory cache (20 min TTL, 60s margin)
  apiClient.ts     # verifyDpsCredentials, createTenancy, markForBankTransfer
  parse.ts         # error envelope parser ({error:{code,message,requestId,details[]}})
  mapDeposit.ts    # property_contracts + tenant + property → CreateTenancy payload
  statusMap.ts     # local status → badge label/colour
  sanitize.ts      # Table-3 special-character whitelist filter for outbound strings

src/features/dps/
  domain/types.ts             # Zod schemas: connection form, create-tenancy form, enums
  data/connections.ts         # super-admin reads (list connections, mask secret)
  data/deposits.ts            # tenant-scoped reads for the deposits hub
  actions/connection.ts       # save/verify/delete credentials (requireRole super admin)
  actions/registerDeposit.ts  # create tenancy; persist dps_deposits row; update contract
  actions/markForBankTransfer.ts
  actions/confirmProtected.ts # manual confirmation (records portal-verified protection)
  ui/DpsConnectionsManager.tsx  # super-admin credential tab (clone TdsConnectionsManager)
  ui/DpsProtectWizard.tsx       # prefill from contract → review/edit → submit
  ui/DpsDepositsPanel.tsx       # per-tenant deposits list + mark-for-transfer + confirm
  ui/DpsStatusBadge.tsx

src/features/help/content/dps.ts   # help article (New Page Checklist)
```

### Touched files

- `src/app/(app)/admin/deposit-schemes/page.tsx` — mount `DpsConnectionsManager`.
- `src/features/deposits/ui/DepositsHub.tsx` (+ its server loader) — third provider tab `dps`, gated on the `dps` entitlement.
- `src/features/contracts/ui/ContractDrawer.tsx` — offer the DPS protect wizard when scheme is unset/`dps` (mirrors TDS wizard hook-in).
- `src/features/help/content/registry.ts` — register the article.
- `.env.example` + `CLAUDE.md` env table — `DPS_TOKEN_SECRET`.
- Super-admin features manager — `dps` feature key appears (driven by the entitlement row; confirm the manager lists it).

**No cron job** — nothing to poll. `src/lib/cron/scheduler.ts` untouched.

### Local deposit state machine

```
draft → submitted → created ──→ marked_for_transfer ──→ protected (manual confirm)
              │                        │
              └── failed / error ──────┘
```

- `created`: DPS returned a deposit ID. Write it to `dps_deposits.deposit_id` **and** mirror to `property_contracts.deposit_scheme='dps'`, `deposit_scheme_ref=<deposit id>` (same mirroring TDS does with the DAN).
- `marked_for_transfer`: store `allocation_reference` + returned `payment_reference`; surface both prominently so the agency puts the right reference on its bank transfer.
- `protected`: **cannot be observed via API.** A "Confirm protected" action lets an admin record the date after checking the DPS portal (stores `protected_confirmed_at/by`). This is honest about what the API can know, and matches the existing manual-scheme-ref flow in the Contract Drawer.

---

## 5. Database changes (one migration, RLS from day one)

`supabase/migrations/<ts>_dps_connections.sql` — table as §3, RLS enabled/no policies, touch trigger.

`supabase/migrations/<ts>_dps_deposits.sql`:

```
dps_deposits
  id                      uuid PK
  tenant_id               uuid NOT NULL → tenants
  contract_id             uuid NOT NULL → property_contracts, UNIQUE (idempotent upsert)
  status                  dps_deposit_status enum (draft|submitted|created|marked_for_transfer|protected|failed|error)
  deposit_id              text            -- 8-digit DPS deposit ID
  allocation_reference    text
  payment_reference       text
  request_id              text            -- DPS requestId for support escalation
  request_payload         jsonb           -- outbound body (no secrets in it by design)
  errors                  jsonb           -- parsed error.details[]
  protected_confirmed_at  timestamptz
  protected_confirmed_by  uuid → user_profiles
  last_error              text
  created_by / created_at / updated_at

dps_api_log  (mirror of tds_api_log: tenant_id, deposit_id, method, path,
              status_code, ok, error, request_id, created_at)
```

RLS (copied from `tds_deposits`, `auth.uid()` always wrapped as `(select ...)` via `current_tenant_id()`/`is_admin()` helpers):

- `dps_deposits`: tenant members SELECT; tenant admins ALL.
- `dps_api_log`: tenant admins SELECT; service-role writes.

`supabase/migrations/<ts>_dps_entitlement.sql` — insert feature key `'dps'` for all existing tenants (mirrors `20260702000002_tds_entitlement.sql`).

Per the security-review process: migrations are generated here, **applied manually** (Supabase MCP stays read-only).

---

## 6. Implementation sequence

1. **Foundations** — `DPS_TOKEN_SECRET` env (+ `.env.example`, CLAUDE.md), `src/lib/dps/{config,encrypt,parse}.ts`.
2. **Token + verify** — `token.ts`, `apiClient.verifyDpsCredentials()` (token fetch = verification). Probe the UAT host early: this empirically settles open questions Q1–Q3 before anything depends on them.
3. **Credentials migration + super-admin UI** — `dps_connections` migration; `features/dps/actions/connection.ts` + `data/connections.ts` + `DpsConnectionsManager`; mount on `admin/deposit-schemes`. Milestone: super admin can save + verify an agency's keys.
4. **Deposit tables + entitlement migrations** — `dps_deposits`, `dps_api_log`, `'dps'` entitlement.
5. **Create tenancy** — `mapDeposit.ts` + `sanitize.ts` + Zod schemas (client **and** server validation, per UI rules); `registerDeposit` action; `DpsProtectWizard` (prefill address/tenants/amounts from the contract, editable, inline field errors mapped from `details[].field`); contract mirroring on success.
6. **Mark for bank transfer** — action + panel UI (input allocation reference, display returned payment reference).
7. **Manual protect confirmation** — `confirmProtected` action + UI.
8. **Hub + drawer wiring** — DepositsHub third tab; ContractDrawer entry point; `DpsStatusBadge`.
9. **Checklist items** — tooltips on every non-obvious control, help article + registry entry, features-manager visibility. (No new searchable entity → no global-search change.)
10. **Verification** — `npx tsc --noEmit` + `npm run build` (repo gotcha: `npm run lint` hangs — no ESLint config), then the sandbox test plan below.

Steps 1–3 are shippable alone (matches how TDS phase 1 landed: credentials first, lifecycle later).

## 7. Test plan (UAT sandbox)

Caveat first: **UAT is mock-only** — it validates and returns canned responses but stores nothing. We can test request validation and our error mapping, but not persisted state or the create→mark sequence with a real deposit ID (Q7).

**Token endpoint**
1. Valid test keys → token returned; cached and reused within TTL.
2. Wrong secret → 400 (`Required`/`BadArgument`) surfaced as a friendly verify error.
3. Expired-token path: force-expire the cache, confirm one transparent re-auth retry on 401.

**Create tenancy**
4. Minimal valid payload (1 tenant, email only) → 200 + deposit ID parsed (empirically pins Q1's response key).
5. Full payload: 10 tenants, RelevantPerson, all optional fields → 200.
6. Both date formats (`DD/MM/YYYY` vs ISO) → discover which is accepted (Q2).
7. Missing `Tenants[0].LastName` → 400 `Required`, mapped inline to the wizard field.
8. Scottish postcode (`EH1 1AA`) → rejection confirms England/Wales rule (Q9).
9. Tenant email == a second tenant's email → `Duplication`.
10. GB mobile not starting `07` / wrong length → `InvalidData`; tenant with neither email nor mobile → error.
11. `TenancyLength` 0 and 109 → `LengthCriteria`/`InvalidData`; `RentAmount` 100,000 → rejected.
12. String with a disallowed character (em-dash, curly quote) → confirm `sanitize.ts` strips it pre-flight rather than DPS rejecting.

**Mark for bank transfer**
13. Well-formed `DepositId` + `AllocationReference` → mock `paymentReference` parsed and stored.
14. 19-char allocation reference → 400 `LengthCriteria`.
15. Malformed deposit ID (7 digits) → 400.

**App-level**
16. Tenant with no `dps_connections` row → hub tab shows "not configured", wizard blocked with a clear message (mirrors E2E plan Phase 10 expectation of graceful failure).
17. Entitlement off → no DPS tab rendered.
18. `dps_deposits` RLS: user from tenant B cannot read tenant A's rows; non-admin cannot mutate.
19. Duplicate protect on the same contract → upserts the existing row (unique `contract_id`), no second DPS submission once `status='created'` (guard in the action — DPS has no idempotency key, Q6).

## 8. Open questions for Debra Anderton (DPS) — blockers flagged

1. **[Blocker] Create success response shape.** The doc shows `"deposit ID": "29933400" }` — malformed JSON with a space in the key. What is the exact response body/key? Is the deposit ID always 8 numeric digits?
2. **[Blocker] Date format.** Table 2 mandates `DD/MM/YYYY` for `TenancyStartDate`/`DatePaid`, but both JSON examples use ISO `YYYY-MM-DD`. Which is accepted (or both)?
3. **[Blocker] Token endpoint URL.** §3.3 says `/v1.0/connect/token`, the example says `</oauth/token>`. Is the token endpoint `https://api-uat.depositprotection.com/v1.0/connect/token` (and the equivalent on prod)? Please confirm full URLs for both environments.
4. Is there **any** way to read tenancy/deposit status via API (e.g. to detect *Protected* after the bank transfer clears), or retrieve the DPC/repayment ID? If not, we will treat protection confirmation as a manual step in our UI.
5. Rate limits or concurrency limits on the token and tenancy endpoints? Any limit on token issuance frequency?
6. **Idempotency**: if the same tenancy is submitted twice (e.g. network retry), does DPS dedupe on `TenancyReference`, or are two tenancies created? Any recommended retry semantics?
7. **UAT testing depth**: since test mode returns mocks and stores nothing, can the mock deposit ID from create be used against MarkForBankTransfer in UAT? Is there any way to do a true end-to-end test before go-live?
8. `AgentLandlordId` — confirm this is the agency's own fixed DPS account number (one value per account), not a per-landlord ID.
9. Confirm scheme scope is England & Wales custodial only (postcode validation implies it) — agencies with Scottish/NI stock need a different scheme, which affects our UI messaging.
10. `DatePaid` "must be before the tenancy start date" — strictly before, or is same-day accepted? In practice deposits are often paid on/after the start date; what should agents send then?
11. Which scheme does the API register — **custodial only**, or can insured tenancies be created?
12. MarkForBankTransfer batching: should the same `AllocationReference` be used across multiple deposits in one batch, and which reference (allocation or the returned `paymentReference`) must appear on the actual bank transfer?
13. JSON property-name casing is inconsistent across the doc's examples (`Title` vs `title`, `MobileNumberCountryCode` vs `mobilenumber`, even `" Tenants"` with a leading space). Is binding case-insensitive?
14. RelevantPerson mobile is specced 9–15 digits while tenant mobile is 11/11 for GB — confirm the rules differ intentionally.
15. Does the 20-minute token get invalidated when a new one is issued (i.e. can two of our processes hold valid tokens concurrently)?

## 9. Assumptions made (due to doc gaps)

- Token endpoint lives on the same hosts as the tenancy endpoints (Q3).
- Create response is JSON containing a single deposit-ID field; we'll parse defensively (accept `depositId` / `DepositId` / `"deposit ID"`) until Q1 is answered.
- We send ISO dates first (matches the examples); flip to `DD/MM/YYYY` if UAT rejects (Q2).
- One DPS account (client ID + `AgentLandlordId`) per tenant — hence `tenant_id` PK on `dps_connections`, same as both existing schemes.
- In-memory token cache is sufficient (single Node process on VPS/PM2 — no serverless fan-out).
- Protection confirmation is manual (Q4) — designed in from the start rather than bolted on.
- Docs are dated 2018–2023; endpoints/validation may have drifted. Early UAT probing (step 2 of the sequence) is the mitigation.

## 10. Effort estimate

**~60–70 % of the TDS integration.** Everything TDS needed, minus its hardest parts:

| Workstream | vs TDS |
|---|---|
| Credentials (migration + encrypt + admin UI + verify) | ≈ same (near-clone) |
| Token layer | small addition TDS didn't need (~½ day incl. UAT probing) |
| Deposit lifecycle | smaller — 2 synchronous calls, **no polling cron, no status mapping from a remote state machine, no certificate, no repayment flow** |
| Wizard/UI | ≈ same shape as `TdsProtectWizard`/`TdsDepositsPanel`, simpler post-submit states |
| Unknown-risk buffer | higher per-unknown than TDS (docs are old, sandbox is mock-only, response shape unconfirmed) — keep Q1–Q3, Q7 in front of DPS before build starts |

Biggest schedule risk is not code: it's the **turnaround on the open questions** and getting working UAT keys issued via the account manager.
