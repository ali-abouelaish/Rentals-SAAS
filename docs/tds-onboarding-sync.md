# TDS ⇄ Contracts Onboarding Sync — Design

Status: **design / not yet built** · Last updated: 2026-07-04

How to reconcile an agency's existing TDS deposits with our contracts during
onboarding, and register the ones that aren't in TDS yet.

---

## Hard constraint: TDS can't list deposits

Every TDS read endpoint is **keyed, not enumerable** — there is no "give me all
my deposits and their DANs" call:

| Endpoint | Input | Returns |
|---|---|---|
| `GET /v1.2/TenancyInformation/<member>/<branch>/<api_key>/<dan>` | a **DAN** | `{ success, status, case_status, dan }` |
| `GET /v1.2/landlord/<member>/<branch>/<api_key>/?filter` | id / email | landlord entities incl. `live_deposits` **count** only |
| `GET /v1.2/property/<member>/<branch>/<api_key>/?filter` | id / postcode | property entities incl. `live_deposits` **count** only |

> **Consequence:** deposits created in the TDS portal *before* onboarding cannot
> be auto-discovered. The **DANs must be seeded from our side** (CSV export from
> the TDS portal). Once we have a DAN we can validate + enrich it via
> `TenancyInformation`, but we can never enumerate DANs from the API.

(All TDS endpoints require the `/v1.2/` version prefix — see
`src/lib/tds/config.ts`. The un-versioned paths 404.)

---

## The model

Every active `deposit_scheme = 'tds'` contract is in one of three states.
Onboarding resolves each one; the TDS CSV export is the pivot that splits
"link these" from "register these".

| State | How we detect it | Action |
|---|---|---|
| **Already linked** | has `property_contracts.deposit_scheme_ref` (DAN) | skip |
| **In TDS, not linked** | matches a row in the CSV export | **reconcile** → link the DAN |
| **Not in TDS** | no CSV match | **bulk-register** via `CreateDeposit` |

Decisions from the user (2026-07-04): starting state is **a mix of both**; DANs
will be supplied via **CSV export from the TDS portal**.

---

## Path 1 — Reconcile from the TDS CSV (the actual "sync")

1. Agency exports their deposit register from the TDS portal → upload CSV.
2. Parse it (`papaparse`, already a dependency).
3. **Match each row to a contract** with a scoring heuristic — postcode +
   tenant surname + deposit amount (+ start date as a tiebreak). Matching must be
   fuzzy: deposits created outside our app won't carry our `contractId`
   (`user_tenancy_reference`).
4. Show a **review table**: each CSV row + proposed contract + confidence score;
   user confirms or reassigns (same review-and-confirm pattern as the AP/Horizon
   import).
5. On confirm, per row:
   - Call `TenancyInformation/<dan>` to prove the member owns the DAN + pull its
     status.
   - Insert a `tds_deposits` row (`status='created'`, `dan` set, `batch_id` null,
     mark `request_payload` with `{ source: 'import' }`).
   - Write `property_contracts.deposit_scheme_ref = dan` +
     `deposit_protected_date`.
   - **No `CreateDeposit` call** — nothing gets duplicated.
6. Surface unmatched CSV rows and unmatched contracts for manual handling.

---

## Path 2 — Bulk-register the rest

Active TDS contracts still without a DAN after import = the "not in TDS" set.

- A "Bulk register with TDS" list lets the user select them.
- Runs each through the existing idempotent `registerTdsDeposit` action
  (throttled/queued).
- The existing `tds-poll` job fills in the DANs.
- Reuses everything already built — just a batch runner + throttle.

---

## What's new to build

- **`getTenancyInformation(ctx, dan)`** in `src/lib/tds/deposits.ts`
  (`GET /v1.2/TenancyInformation/…`). Does not exist yet. Note: imported deposits
  have **no `batch_id`**, so they can't use the `CreateDepositStatus` poller —
  DAN-status refresh for imported deposits must go through `TenancyInformation`.
- **Onboarding import screen** — upload → match → review → link.
- **Batch-register runner** for Path 2.
- (Optional) a DAN-keyed status refresh for imported deposits, since the current
  poller only handles `submitted`/`pending` rows created by us.

---

## Reused infrastructure (already built)

- `tds_deposits` table (unique on `contract_id`; status enum incl. `created`).
- `registerTdsDeposit` action (idempotent — guards on `batch_id`).
- `tds-poll` cron/in-process job (polls `submitted`/`pending` via
  `CreateDepositStatus`).
- `property_contracts.deposit_scheme_ref` + `deposit_protected_date` as the link.
- Per-agency creds via `tds_connections` + `getTdsContext`.

---

## Open items / blockers

1. **BLOCKER — CSV format.** Need the real TDS portal export: header row + 2–3
   anonymised rows. Must confirm it includes: **DAN**, property
   **postcode/address**, **tenant name**, **deposit amount**, dates. This
   determines the match keys and the parser. Cannot build the matcher without it.
2. **Where it lives** — in-app admin screen (repeatable per agency,
   non-technical; **recommended**) vs a CLI script like the existing `import/`
   pipeline (less work, one-off). Undecided.
3. Matching thresholds / auto-accept confidence cutoff — TBD after seeing the CSV.

---

## Suggested build order

1. Get the CSV sample (blocker #1).
2. Add `getTenancyInformation` to the TDS lib.
3. Build **Path 1 (reconcile)** — the actual sync.
4. Wire **Path 2 (bulk register)** on top of the existing action.
