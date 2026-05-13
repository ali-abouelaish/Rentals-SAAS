# Harbor Ops scripts

## Deploy

Fast deploy workflow that ships the local `.next` build to the VPS so the VPS does not have to rebuild.

### Usage

```bash
npm run deploy     # build locally, rsync to VPS, reload PM2
npm run rollback   # swap the previous build back in and reload PM2
```

### What each script does

`scripts/deploy.sh` runs `npm run build` locally, backs up the remote `.next` to `.next.prev`, rsyncs `.next/` (minus `cache`), `public/`, `package.json`, `package-lock.json`, and `next.config.mjs` to the VPS, runs `npm ci --omit=dev` only if `package-lock.json` actually changed, then reloads the `harborops` PM2 process. It prints the deployed git SHA on success.

`scripts/rollback.sh` swaps `.next` and `.next.prev` on the VPS so the previous build becomes active, then reloads PM2. It refuses to run if no `.next.prev` exists.

### Notes

- `git push` is a separate step. The deploy script does not push, and pushing does not deploy. Push first if you want the deployed code on the remote branch.
- The first deploy with this workflow is slower because `.next.prev` does not exist yet and rsync has no prior `.next` on the VPS to delta against; subsequent deploys only ship changed chunks.
- Native deps (Sharp, etc.) are still installed on the VPS via `npm ci` when `package-lock.json` changes, so macOS-vs-Linux binary mismatches are not an issue.
- The scripts only need `bash`, `rsync`, and `ssh` locally. SSH key auth must be set up for `root@187.124.112.229`.
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
