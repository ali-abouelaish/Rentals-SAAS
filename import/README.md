# AP Real Estate / Horizon Dreams portfolio import

Staged, idempotent reconciliation pipeline that onboards the
`PORTFOLIO AVAILIABILITY.xlsx` workbook (filename misspelling is real) onto
Harbor Ops. The system already holds most of this data — the pipeline parses
the sheet, fetches current DB state, diffs, and applies only what's missing or
safely fixable. **Nothing is ever deleted, and dry run is the default.**

## Running

```bash
node --env-file=.env.local import/run.mjs                   # full dry run (parse → normalize → contracts → diff)
node --env-file=.env.local import/run.mjs --no-db           # offline: stop after normalize
node --env-file=.env.local import/run.mjs --skip-download   # use cached PDFs in import/contracts/
node --env-file=.env.local import/run.mjs --commit          # APPLY the planned operations
node --env-file=.env.local import/run.mjs --commit --images # also import property images from Drive folders
# or: npm run import:portfolio -- [flags]
```

Flags: `--file <xlsx>` (default `import/source/...`), `--tenant <uuid>`
(default: the live "AP Real Estate" tenant `b5b00020-…`; deliberately ignores
`TENANT_ID` env which points at the dev seed tenant), `--precedence sheet`
(make availability/rent conflicts auto-apply sheet values once question 8 is
answered).

Artifacts in `import/out/`: `raw.json`, `graph.json`, `contracts.json`,
`diff.json`, `apply.json`, and **`import_report.md`** (the human-review report:
every fix, warning, blocker, conflict and manual-entry item with sheet row refs).

## Stages

1. **Parse** (`lib/parse.mjs`) — all three tabs; sections located by banner
   text (never row numbers); captures hyperlink targets (`cell.l`) for the
   Property (Drive image folders) and Contract (head address folders / signed
   PDF files) columns.
2. **Normalize** (`lib/normalize.mjs` + `config.mjs`) — canonical area /
   name / postcode maps, availability extractor, E.164 phones (UK default,
   slash-separated pairs → phone + whatsapp, date-shaped values nulled),
   email fixes, DOB sanity (future / <16 / >100), title-cased names (raw
   preserved in notes), dual-rent rule (first value = rent+deposit, pair =
   unit min/max), beds/baths as property attributes (1.5 baths → 2 +
   `separate_wc`, the system convention).
3. **Contracts** (`lib/contracts.mjs`) — downloads signed PDFs by Drive file
   id, extracts start dates near commencement keywords (never guessed; manual
   entry list otherwise), cross-checks end dates vs the Available column,
   checks the tenant's name appears in the PDF.
4. **Fetch + diff** (`lib/db.mjs`, `lib/diff.mjs`) — two-pass matching
   (import_ref exact, then natural keys: property fuzzy name/alias/head
   address + postcode, room code within property, tenant email→phone→name+DOB).
   Classification: create / update / unchanged / system-only (reported, never
   deleted) / review. A blank sheet value never overwrites the system; value
   conflicts are reported, not applied (Q8); canonical-map fixes auto-apply.
   Confident matches get `import_ref` backfilled (requires migration
   `20260612000001_import_ref_columns.sql` — until applied, matching is
   natural-key only and the report says so).
5. **Apply** (`lib/apply.mjs`) — `--commit` only. Ordered: portfolios →
   properties → units → pm_tenants → contracts (uploads the signed PDF to the
   `property_contracts` bucket, sets `document_url`, mirrors active contracts
   onto units) → keys → bank details. Uses a single pg transaction when
   `SUPABASE_DB_URL` is set; otherwise sequential supabase-js (idempotent
   reruns repair partial failures).
6. **Images** (`lib/images.mjs`) — `--images`. Lists each property's Drive
   folder (service account via `GOOGLE_SERVICE_ACCOUNT_PATH`, falling back to
   the public embeddedfolderview), uploads to the `property_photos` bucket as
   property-level communal photos, inserts `unit_photos` rows, skips files
   already attached (by filename).

`import/selftest.mjs` asserts every known data-quality case from the spec
(section 5) against the extractors — run `node import/selftest.mjs` after
changing `config.mjs` or `normalize.mjs`.

## Standing decisions (do not re-ask)

- Deposit = one month's rent = PCM, every tenancy.
- Missing start dates come from signed contract PDFs or the manual entry list — never guessed.
- Horizon Dreams = sibling portfolio under the same agency tenant (matches live data).
- Deposit scheme / landlords / rent due day: unknown, left null (rent tracker = file 2, bolts on later).
- `rent_payments` are NOT created by this import (file 2 scope).

## Open questions still pending (see spec §8)

- Q4 dual rent (defaulted: first value, flagged), Q5 AP tenancy stubs
  (defaulted: rooms imported, tenancies on manual list — `property_contracts`
  requires `pm_tenant_id` + `start_date`, so stubs can't be DB rows without
  inventing data), Q7 PCM = contractual rent (assumed), Q8 conflict precedence
  (defaulted: report-only; `--precedence sheet` exists), Q9 turnover
  (defaulted: review, never auto-end).
