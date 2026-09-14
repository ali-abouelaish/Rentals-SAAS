# Harbor Ops scripts

## Deploy

Fast deploy workflow that ships the local `.next` build to the VPS so the VPS does not have to rebuild.

### Usage

```bash
npm run deploy     # build locally, rsync to VPS, reload PM2, health check
npm run deploy -- -y   # skip the confirmation prompt (CI / non-interactive)
npm run rollback   # swap the previous build back in and reload PM2
```

### What each script does

`scripts/deploy.sh`:

1. **Push guard** — warns if the working tree is dirty, the branch has no upstream, or the local branch is ahead of its remote (i.e. the deployed code is not all pushed). These are warnings, not hard stops.
2. **Confirmation** — prints the target host/path/branch/SHA and the warnings above, then requires a `y/N` confirmation before touching the remote. Skip with `-y` / `--yes`, or `DEPLOY_YES=1`. In a non-interactive shell it aborts unless `-y` is given.
3. Runs `npm run build` locally, backs up the remote `.next` to `.next.prev`, rsyncs `.next/` (minus `cache`), `public/`, `package.json`, `package-lock.json`, and `next.config.mjs` to the VPS, runs `npm ci --omit=dev` only if `package-lock.json` actually changed, then reloads the `harborops` PM2 process.
4. **Health check + auto-rollback** — curls `http://127.0.0.1:3000/` on the VPS (up to 10 tries, 3s apart). A reachable response under HTTP 500 counts as healthy. If it never comes up, the script automatically swaps `.next.prev` back in, reloads PM2, and exits non-zero (the failed build is preserved at `.next.prev`). If this was the first deploy with no backup, it cannot auto-roll back and tells you to check `pm2 logs` instead.

It prints the deployed git SHA on success.

`scripts/rollback.sh` swaps `.next` and `.next.prev` on the VPS so the previous build becomes active, then reloads PM2. It refuses to run if no `.next.prev` exists.

### Notes

- `git push` is a separate step. The deploy script does not push, and pushing does not deploy. Push first if you want the deployed code on the remote branch.
- The first deploy with this workflow is slower because `.next.prev` does not exist yet and rsync has no prior `.next` on the VPS to delta against; subsequent deploys only ship changed chunks.
- Native deps (Sharp, etc.) are still installed on the VPS via `npm ci` when `package-lock.json` changes, so macOS-vs-Linux binary mismatches are not an issue.
- The scripts only need `bash`, `rsync`, and `ssh` locally. SSH key auth must be set up for `root@187.124.112.229`.
- **Windows:** run from Git Bash with npm's `script-shell` pointed at Git Bash (`npm config set script-shell "C:\Program Files\Git\bin\bash.exe"`) so the build's `NODE_OPTIONS=...` prefix works. Install rsync via `choco install rsync` (Chocolatey ships cwRsync). Because cwRsync is Cygwin-based, `deploy.sh` automatically pins `RSYNC_RSH` to the ssh bundled with cwRsync — mixing it with Git Bash/Windows ssh otherwise fails with `dup() in/out/err failed`.
- Make them executable once: `chmod +x scripts/deploy.sh scripts/rollback.sh` (the npm scripts invoke them via `bash` so this is optional).

---

# SpareRoom scraper – profiles from landlord profiles

Profile URLs are loaded from the app’s **landlord profiles** (SpareRoom URL + paying/flag) instead of a Google Sheet.

## 1. App API

- **Route:** `GET /api/landlords/spareroom-profiles?tenant_id=<uuid>`
- **Auth:** `Authorization: Bearer <SCRAPER_API_KEY>`
- **Env (server):** `SCRAPER_API_KEY` – set a secret string and use the same value in the scraper.

## 2. Scraper env (Python)

In `.env` or the environment where you run the scraper:

- `APP_URL` or `NEXT_PUBLIC_APP_URL` – e.g. `http://localhost:3000` or your deployed URL  
- `SCRAPER_API_KEY` – same value as on the server  
- `TENANT_ID` – your tenant UUID (Supabase Dashboard → Table Editor → **tenants** → copy the row `id`)
- **Supabase (required for posting listings):** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — the scraper posts to the **scraped_listings** table instead of Google Sheets. Install: `pip install supabase`.

Run from project root (with the Next.js app running): `python scripts/OGSCRPAPER.py`. The script loads vars from `.env.local` via python-dotenv.

`TENANT_ID` is per-invocation, not global: the script handles exactly one tenant per run and scopes every write and every delete to it. To cover several tenants, invoke it once per tenant.

`LANDLORD_ID` (optional) narrows a run to a single landlord — what the in-app **Run scraper** button sets. A narrowed run deliberately skips the orphan sweep, because one profile tells it nothing about the rest of the roster.

## 2a. Schedule

The daily run is scheduled **in the repo**, not in the VPS crontab: the schedule lives in `src/lib/cron/jobCatalogue.ts` and fires at **09:00 Europe/London** via node-cron (registered by `src/lib/cron/scheduler.ts`, started from `src/instrumentation.ts` when the Node server boots). It shares that slot with the rent-reminder job. There is a manual/backup trigger at `GET /api/cron/spareroom-scraper`, guarded by `CRON_SECRET`.

> **Deploying this for the first time:** remove the old `OGSCRPAPER.py` line from the VPS crontab (`crontab -e` as the app user), or the scrape runs twice a night. `flock` keeps the two from overlapping, so nothing corrupts if you forget — the second run just fails on the lock — but the crontab copy is the reason the deployed script drifted several builds behind the repo in the first place.

Both entry points serialise on `/tmp/harborops_scraper.lock`. That matters: each run sweeps rows whose `last_seen_at` predates its own start, so two concurrent runs would sweep each other's writes.

## 2b. How rows are written

Runs **upsert then sweep**, rather than delete then insert:

1. Each listing is keyed by `external_ref = spareroom:<advert id>`, derived from the advert URL, so a re-read updates the same row. Row ids survive, and with them `leads.listing_id` — the old delete/insert cycle minted new ids nightly and silently severed every SpareRoom lead's link to its listing.
2. Every row written gets `last_seen_at` = the run's start timestamp.
3. Afterwards, rows for landlords the run read **end-to-end** whose `last_seen_at` is older than that are deleted: they were live yesterday and are not live now.

A landlord only counts as read end-to-end if the profile paginated cleanly *and* every listing page under it loaded. Anything less and the landlord is neither written nor swept, and their existing rows are left alone — the run reports them so they can be chased. This is what keeps a hiccup at SpareRoom from wiping good data, and it is why the run also refuses to treat an unrecognised HTTP 200 (soft block, captcha interstitial, renamed markup) as "this landlord has no live ads".

A guarded orphan sweep clears the two classes no landlord-scoped sweep can reach — rows whose landlord was deleted (`landlord_id` is null), and rows for a landlord whose `spareroom_profile_url` has since been cleared. It runs only on a full-roster run where at least half the roster read cleanly.

Scope: all of this is `source = 'spareroom'` only. Spreadsheet-imported rows are untouched and keep their own no-delete behaviour.

## 3. Replace the “load from Google Sheet” block

Replace the block that loads from the public Google Sheet CSV with one of the two options below.

**Option A – Use the helper script (recommended)**

At the top of your scraper, add:

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scripts"))
from load_spareroom_profiles import load_profiles_from_app

profiles, paying_flags, property_flags = load_profiles_from_app()
if not profiles:
    print("No profiles loaded. Check APP_URL, SCRAPER_API_KEY, TENANT_ID.")
    sys.exit(1)
```

If your script lives inside the SAAS repo, you can instead do:

```python
from load_spareroom_profiles import load_profiles_from_app
# ... then:
profiles, paying_flags, property_flags = load_profiles_from_app()
```

**Option B – Inline request**

```python
import requests
import os

app_url = (os.environ.get("APP_URL") or os.environ.get("NEXT_PUBLIC_APP_URL")).rstrip("/")
tenant_id = os.environ.get("TENANT_ID")
api_key = os.environ.get("SCRAPER_API_KEY")
r = requests.get(
    f"{app_url}/api/landlords/spareroom-profiles?tenant_id={tenant_id}",
    headers={"Authorization": f"Bearer {api_key}"},
    timeout=15,
)
r.raise_for_status()
data = r.json()
profiles = data.get("profiles", [])
paying_flags = (data.get("paying_flags") or [""])[: len(profiles)]
while len(paying_flags) < len(profiles):
    paying_flags.append("")
property_flags = (data.get("profile_flags") or [""])[: len(profiles)]
while len(property_flags) < len(profiles):
    property_flags.append("")
```

After that, keep the rest of your script (scrape each profile URL, then scrape each listing, then push to Google Sheets) unchanged.
