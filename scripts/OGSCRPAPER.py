import requests
from bs4 import BeautifulSoup
import time
import sys
import os
import re
from urllib.parse import urlparse, parse_qs, unquote

# Load .env.local / .env so APP_URL, SCRAPER_API_KEY, TENANT_ID are set when run from project root
try:
    from dotenv import load_dotenv
    _root = os.path.dirname(os.path.dirname(os.path.abspath(os.path.realpath(__file__))))
    for _f in (".env.local", ".env"):
        _path = os.path.join(_root, _f)
        if os.path.isfile(_path):
            load_dotenv(_path, override=False)
    for _f in (".env.local", ".env"):
        _path = os.path.join(os.getcwd(), _f)
        if os.path.isfile(_path):
            load_dotenv(_path, override=False)
except ImportError:
    pass

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# -----------------------------
# 1) Load landlord SpareRoom profiles from app DB (via API)
# -----------------------------

app_url = (os.environ.get("APP_URL") or os.environ.get("NEXT_PUBLIC_APP_URL") or "").strip().rstrip("/")
tenant_id = os.environ.get("TENANT_ID")
api_key = os.environ.get("SCRAPER_API_KEY")

# Dev fallback: if TENANT_ID missing, grab the first tenant via Supabase service role
if not tenant_id and os.environ.get("NEXT_PUBLIC_SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
    try:
        _supabase_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
        _sr_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _r0 = requests.get(
            f"{_supabase_url}/rest/v1/tenants?select=id&limit=1",
            headers={"apikey": _sr_key, "Authorization": f"Bearer {_sr_key}"},
            timeout=10,
        )
        if _r0.ok and _r0.json():
            tenant_id = _r0.json()[0].get("id")
    except Exception:
        pass

if not app_url or not tenant_id or not api_key:
    raise SystemExit("Set APP_URL, SCRAPER_API_KEY and TENANT_ID in env (or Supabase vars for tenant fallback).")

_r = requests.get(
    f"{app_url}/api/landlords/spareroom-profiles?tenant_id={tenant_id}",
    headers={"Authorization": f"Bearer {api_key}"},
    timeout=15,
)
if not _r.ok:
    print(f"API error {_r.status_code}: {_r.text[:500]}", file=sys.stderr)
    raise SystemExit(f"Profiles API returned {_r.status_code}. Is the app running at {app_url}?")
try:
    _data = _r.json()
except Exception as e:
    print(f"API response was not JSON. Status: {_r.status_code}", file=sys.stderr)
    print(f"Response (first 500 chars): {_r.text[:500]}", file=sys.stderr)
    raise SystemExit("Profiles API did not return JSON. Is the Next.js app running?") from e

profiles = _data.get("profiles", [])
paying_flags = (_data.get("paying_flags") or [""] * len(profiles))[: len(profiles)]
property_flags = (_data.get("profile_flags") or [""] * len(profiles))[: len(profiles)]
landlord_names = (_data.get("names") or [""] * len(profiles))[: len(profiles)]

# landlord_id is the identity every write and every sweep below is keyed on, so a
# missing id list is a broken contract, not a value to default. Degrading it to
# blanks used to make the whole run write rows with a NULL landlord_id — rows no
# later run could match, update or clear, so they accumulated forever.
_ids = _data.get("ids") or []
if profiles and len(_ids) != len(profiles):
    raise SystemExit(
        f"Profiles API returned {len(profiles)} profiles but {len(_ids)} ids. "
        "Refusing to run: without a landlord id per profile, rows cannot be "
        "matched or cleared on later runs."
    )
landlord_ids = [str(i).strip() if i else "" for i in _ids[: len(profiles)]]
_missing_ids = [p for p, lid in zip(profiles, landlord_ids) if not lid]
if _missing_ids:
    raise SystemExit(
        f"Profiles API returned {len(_missing_ids)} profile(s) with no landlord id "
        f"(e.g. {_missing_ids[0]}). Refusing to run for the same reason."
    )
# Landlord id -> display name lookup, used in the end-of-run diagnostic
LANDLORD_NAME_BY_ID = {lid: name for lid, name in zip(landlord_ids, landlord_names) if lid}
print(f"Loaded {len(profiles)} landlord profiles from DB for tenant {tenant_id}")

# Optional on-demand filter: scope this run to a single landlord (set by the
# in-app "Run scraper" button instead of the daily all-landlords cron run).
landlord_id_filter = (os.environ.get("LANDLORD_ID") or "").strip()
if landlord_id_filter:
    _keep = [i for i, lid in enumerate(landlord_ids) if lid == landlord_id_filter]
    if not _keep:
        raise SystemExit(
            f"Landlord {landlord_id_filter} not found among profiles with a SpareRoom URL set."
        )
    profiles = [profiles[i] for i in _keep]
    paying_flags = [paying_flags[i] for i in _keep]
    property_flags = [property_flags[i] for i in _keep]
    landlord_ids = [landlord_ids[i] for i in _keep]
    landlord_names = [landlord_names[i] for i in _keep]
    # Narrow the id->name map too, so the end-of-run "produced 0 listings"
    # diagnostic reflects only this landlord, not the whole tenant.
    LANDLORD_NAME_BY_ID = {lid: LANDLORD_NAME_BY_ID.get(lid, "") for lid in landlord_ids}
    print(f"Filtered to landlord {landlord_id_filter} ({landlord_names[0]}) — 1 profile")

# -----------------------------
# 2) Scraper setup
# -----------------------------

base_url = "https://www.spareroom.co.uk"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.spareroom.co.uk/",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
}

session = requests.Session()
session.headers.update(headers)
# Warm up cookies so subsequent requests look like a real browsing session
try:
    session.get(base_url, timeout=10)
except Exception:
    pass


# Profile path matcher: /u12345 or /pro/SomeAgent
PROFILE_PATH_RE = re.compile(r"^/(u\d+|pro/[\w-]+)/?$")


def classify_url(url):
    """Classify a stored landlord URL.

    Returns one of:
      ('profile', profile_url)  — a clean SpareRoom profile (e.g. /u20824796 or /pro/CrownCentral)
      ('listing', listing_url)  — a flatshare_detail.pl URL we cannot promote to a profile
      ('unknown', url)          — unrecognised, caller should skip with a warning

    Handles the legacy case where a flatshare_detail.pl URL has a search_results
    query param pointing at a profile path — those are promoted to ('profile', ...).
    """
    if not url:
        return ("unknown", url)
    try:
        parsed = urlparse(url)

        # Already a profile path
        if PROFILE_PATH_RE.match(parsed.path):
            return ("profile", url)

        # Listing detail page — see if search_results encodes a profile path
        if "flatshare_detail.pl" in parsed.path:
            sr = parse_qs(parsed.query).get("search_results", [""])[0]
            sr_path = unquote(sr or "").split("?", 1)[0].strip()
            if PROFILE_PATH_RE.match(sr_path):
                return ("profile", f"{base_url}{sr_path}")
            return ("listing", url)

        # Pretty listing URL: /flatshare/<city>/<area>/<id> (ends in a numeric id).
        # A single ad, not a profile — use the "More from advertiser" sidebar
        # fallback rather than skipping the landlord entirely.
        if re.match(r"^/flatshare/(?:[\w-]+/)*\d+/?$", parsed.path):
            return ("listing", url)
    except Exception:
        pass
    return ("unknown", url)


# ---------------------------------------------------------------------------
# Stable row identity
# ---------------------------------------------------------------------------
# Every SpareRoom row is written under an external_ref derived from the advert's
# own id, so a re-read UPDATES the existing row instead of replacing it. That is
# what lets leads.listing_id (references scraped_listings(id) on delete set null)
# survive a scrape: the old delete-then-insert cycle handed every listing a new
# uuid each night and silently severed the link.
#
# Namespaced with a "spareroom:" prefix because the uniqueness constraint behind
# the upsert is (landlord_id, external_ref) across ALL sources — an unprefixed id
# or bare URL could collide with a landlord's spreadsheet row and let one source
# overwrite the other's listing.
#
# Kept deliberately in step with the SQL in
# supabase/migrations/20260822000001_spareroom_listing_identity.sql, which
# backfills this same value onto existing rows. If you change the derivation
# here, that backfill no longer matches and every row is re-created once.
def spareroom_external_ref(url):
    """Stable identity for a SpareRoom advert, derived from its URL.

    Both URL shapes carry the same advert id:
      /flatshare/flatshare_detail.pl?flatshare_id=18333812&...  -> spareroom:18333812
      /flatshare/london/camden/18333812                         -> spareroom:18333812

    The query string is otherwise volatile (search_id, search_results, city_id all
    change run to run), so keying on the id rather than the URL is what keeps a
    listing the same row across runs. Falls back to the full URL when no id can be
    found, which is still stable enough to upsert on and is visible in the DB as
    the odd one out.
    """
    if not url:
        return None
    m = re.search(r"[?&]flatshare_id=(\d+)", url)
    if m:
        return f"spareroom:{m.group(1)}"
    path = url.split("#", 1)[0].split("?", 1)[0]
    m = re.search(r"/(\d+)/?$", path)
    if m:
        return f"spareroom:{m.group(1)}"
    return f"spareroom:url:{url}"


def extract_more_from_sidebar(soup):
    """Pull listing hrefs from the 'More from the same advertiser' sidebar on a
    flatshare detail page. Returns a list of hrefs (may be relative or absolute).

    Note: SpareRoom typically caps this list at a small number (often <5), so
    listing-URL landlords will under-harvest compared to profile-URL landlords.
    """
    urls = []
    for sidebar in soup.find_all("div", class_="listing-sidebar-box"):
        title_elem = sidebar.find("h3", class_="listing-sidebar-box__title")
        title_text = title_elem.get_text(" ", strip=True).lower() if title_elem else ""
        if "more from" not in title_text:
            continue  # skip "Similar nearby", "Recently viewed", etc.
        for li in sidebar.select("li.listing-sidebar-box__list-item"):
            a = li.find("a", href=True)
            if a:
                urls.append(a["href"])
        break
    return urls


def fetch_with_retry(url, max_attempts=4, timeout=15):
    """GET via session, retrying transient 503/429/502/504 with backoff."""
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            resp = session.get(url, timeout=timeout)
            if resp.status_code in (503, 429, 502, 504):
                wait = 2 ** attempt
                print(f"   ⏳ {resp.status_code} — retry {attempt}/{max_attempts} in {wait}s")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            # SpareRoom often omits charset; bytes are UTF-8 in practice. Forcing
            # this avoids 'requests' falling back to ISO-8859-1 and producing
            # mojibake (e.g. 🔥 -> ð¥) in titles/descriptions.
            resp.encoding = "utf-8"
            return resp
        except requests.RequestException as e:
            last_exc = e
            wait = 2 ** attempt
            print(f"   ⏳ {e.__class__.__name__} — retry {attempt}/{max_attempts} in {wait}s")
            time.sleep(wait)
    if last_exc:
        raise last_exc
    raise requests.HTTPError(f"Exhausted retries for {url}")


# ---------------------------------------------------------------------------
# Telling "no live ads" apart from "we were not really served the page"
# ---------------------------------------------------------------------------
# fetch_with_retry raises on 4xx/5xx, so those never reach here. What does reach
# here is HTTP 200 carrying HTML we did not expect: a soft block, a captcha
# interstitial, a moved profile, or SpareRoom renaming the listing-card markup.
# All of them look identical to "this landlord has nothing live" — zero elements
# with class listing-card__link — and treating them as such would clear every row
# the landlord has. Since a clean read is what licenses the sweep further down,
# a page we cannot positively identify must not count as clean.
BLOCKED_PAGE_MARKERS = (
    "captcha",
    "unusual traffic",
    "are you a robot",
    "access denied",
    "temporarily blocked",
    "rate limit",
    "cf-browser-verification",
    "just a moment...",
    "please enable javascript",
)

# Wording SpareRoom uses when a profile genuinely has nothing listed. Matching one
# of these is positive proof of an empty profile rather than an absence of proof.
EMPTY_PROFILE_MARKERS = (
    "no adverts",
    "no ads",
    "0 results",
    "no results",
    "no rooms",
    "no listings",
    "doesn't have any",
    "does not have any",
    "currently has no",
    "nothing to show",
)


def classify_empty_page(html, offset):
    """Why does this page carry no listing cards? Returns one of:

      "end"     — genuinely nothing (more) here; safe to treat as authoritative
      "blocked" — an interstitial/soft block wearing a 200
      "unknown" — 200 with HTML we do not recognise; assume nothing

    offset > 0 counts as "end" because we already parsed listing cards from this
    same profile on an earlier page: the site was serving us real HTML moments
    ago, so running out of cards is the end of the walk, not a block.
    """
    low = (html or "").lower()
    for marker in BLOCKED_PAGE_MARKERS:
        if marker in low:
            return "blocked"
    if offset > 0:
        return "end"
    for marker in EMPTY_PROFILE_MARKERS:
        if marker in low:
            return "end"
    return "unknown"


all_results = []   # ← this is now your main array

# Landlords whose SpareRoom pages we actually loaded and read to the end.
# Only these are safe to clear out in the write step. "0 listings" from a page we
# read cleanly is a real answer (ads pulled, not accepting, no photos), so the old
# rows should go. "0 listings" from a page we never loaded is a transient failure,
# and deleting on that would wipe good data every time SpareRoom hiccups.
reached_landlord_ids = set()

# -----------------------------
# 3) Scrape each profile (or listing fallback)
# -----------------------------
for raw_url, paying_flag, property_flag, landlord_id in zip(
    profiles, paying_flags, property_flags, landlord_ids
):
    kind, resolved = classify_url(raw_url)

    if kind == "unknown":
        print(f"\n⚠️ Skipping {raw_url} — unrecognised URL format")
        continue

    # ----- LISTING URL FALLBACK -----
    # The stored URL points at a single ad; harvest the "More from the same
    # advertiser" sidebar. This is capped by SpareRoom and will under-harvest
    # compared to a profile URL — flag the landlord so the user can update it.
    if kind == "listing":
        print(f"\n📄 Listing URL detected: {resolved}")
        print(f"   Using 'More from advertiser' sidebar fallback (will under-harvest)")
        try:
            response = fetch_with_retry(resolved)
            soup = BeautifulSoup(response.text, "html.parser")

            page_links = {resolved}  # always include the listing itself
            for href in extract_more_from_sidebar(soup):
                full_url = href if href.startswith("http") else base_url + href
                page_links.add(full_url)

            print(f"   Collected {len(page_links)} listing(s) "
                  f"(1 main + {len(page_links) - 1} from sidebar)")

            for link in page_links:
                all_results.append({
                    "profile": resolved,
                    "url": link,
                    "paying": paying_flag,
                    "profile_flag": property_flag,
                    "landlord_id": landlord_id if landlord_id else None,
                })
            if landlord_id:
                reached_landlord_ids.add(landlord_id)
        except Exception as e:
            print(f"⚠️ Error scraping listing page {resolved}: {e}")
        continue  # next landlord — skip the profile pagination below

    # ----- PROFILE URL: NORMAL PAGINATION -----
    profile_url = resolved
    if profile_url != raw_url:
        print(f"\n🔧 Promoted listing search_results → profile: {profile_url}")
    print(f"\n🔍 Scraping profile: {profile_url}")
    if property_flag:
        print(f"   📌 Will apply flag: {property_flag}")
    offset = 0
    prev_page_links = set()
    pagination_ok = False  # True only if we walked every page without an error

    while True:
        page_url = (
            f"{profile_url}?offset={offset}"
            if "?" not in profile_url
            else f"{profile_url}&offset={offset}"
        )

        try:
            response = fetch_with_retry(page_url)
            soup = BeautifulSoup(response.text, "html.parser")

            listings = soup.find_all("a", class_="listing-card__link")
            if not listings:
                verdict = classify_empty_page(response.text, offset)
                if verdict == "end":
                    pagination_ok = True
                elif verdict == "blocked":
                    print("   🛑 Served a block/interstitial page, not listings — "
                          "cannot vouch for this landlord, existing rows kept")
                else:
                    # Print what we were actually served. The empty-profile
                    # wording below is the one thing here that cannot be verified
                    # without hitting SpareRoom, so if a genuinely empty profile
                    # keeps landing in this branch, the title is what tells you
                    # which phrase to add to EMPTY_PROFILE_MARKERS.
                    title = soup.find("title")
                    title_text = title.get_text(strip=True)[:120] if title else "(no <title>)"
                    print("   ❓ 200 with no listing cards and nothing identifying it as an "
                          "empty profile — cannot vouch for this landlord, existing rows kept")
                    print(f"      page title: {title_text}")
                break

            current_page_links = set()

            for a in listings:
                href = a.get("href")
                if href:
                    full_url = href if href.startswith("http") else base_url + href
                    current_page_links.add(full_url)

            if current_page_links == prev_page_links:
                pagination_ok = True
                break

            for link in current_page_links:
                all_results.append({
                    "profile": profile_url,
                    "url": link,
                    "paying": paying_flag,
                    "profile_flag": property_flag,
                    "landlord_id": landlord_id if landlord_id else None,
                })

            prev_page_links = current_page_links
            offset += 10
            time.sleep(1.5)

        except Exception as e:
            print(f"⚠️ Error fetching {page_url}: {e}")
            break

    # Only a clean walk of every page proves the profile is genuinely empty. An
    # error part-way through leaves us holding partial data, so this landlord is
    # not authoritative and must keep whatever rows it already has.
    if pagination_ok and landlord_id:
        reached_landlord_ids.add(landlord_id)

# -----------------------------
# 4) Deduplicate & prepare array
# -----------------------------

# Deduplicate by URL
seen = set()
listings = []

for item in all_results:
    if item["url"] not in seen:
        seen.add(item["url"])
        listings.append(item)

print(f"\n✅ Finished scraping {len(listings)} unique listings")

# `listings` is now your ARRAY — pass it to the next step




import json

def clean_text(text):
    """Clean and normalize text data (for titles, small fields)"""
    if not text or text == "N/A":
        return None
    text = re.sub(r'\s+', ' ', text.strip())  # remove extra whitespace
    text = re.sub(r'<[^>]+>', '', text)       # remove HTML tags
    if len(text) > 500:
        text = text[:500] + "..."
    return text

def extract_rich_text(elem):
    """Extract text while preserving emojis and newlines from <br> tags (for description only)"""
    if not elem:
        return None
    for br in elem.find_all("br"):
        br.replace_with("\n")
    text = elem.get_text()
    text = text.strip()
    return text if text else None

def extract_price(price_text):
    """Extract and normalize price information (convert pw → monthly if needed)"""
    if not price_text or price_text == "N/A":
        return None

    price_match = re.search(r'£?(\d+(?:,\d+)?(?:\.\d{2})?)', str(price_text))
    if price_match:
        price = price_match.group(1).replace(',', '')
        try:
            price = float(price)
            text_lower = price_text.lower()

            if "pw" in text_lower or "per week" in text_lower:
                # Convert weekly → monthly (average 52 weeks / 12 months)
                price = round(price * 52 / 12)

            else:
                # Assume price is already per month
                price = round(price)

            return int(price)
        except:
            return None
    return None


def parse_money_to_int(text):
    """Extract £ number from text, return int (e.g. '£950.00' -> 950)."""
    if not text:
        return None
    m = re.search(r"£\s*([0-9][0-9,]*)(?:\.\d{2})?", str(text))
    if not m:
        return None
    return int(m.group(1).replace(",", ""))

def normalize_room_type(text):
    """Normalize room type to single/double/ensuite/studio/etc."""
    if not text:
        return None
    t = text.strip().lower()
    # SpareRoom often uses: single, double, ensuite, twin, studio
    if "en-suite" in t or "ensuite" in t or "en suite" in t:
        return "ensuite"
    if "single" in t:
        return "single"
    if "double" in t:
        return "double"
    if "studio" in t:
        return "studio"
    return t  # fallback

def extract_room_options(soup, max_rooms=6):
    """
    Extract per-room options from <section class="feature--price_room_only">.
    Returns list like:
    [{"room_index":1,"price_pcm":950,"room_type":"double"}, ...]
    """
    rooms = []
    dl = soup.select_one("section.feature--price_room_only dl.feature-list")
    if not dl:
        return rooms

    dts = dl.find_all("dt", class_="feature-list__key")
    dds = dl.find_all("dd", class_="feature-list__value")

    for i, (dt, dd) in enumerate(zip(dts, dds), start=1):
        if i > max_rooms:
            break
        price_text = dt.get_text(" ", strip=True) if dt else ""
        room_type_text = dd.get_text(" ", strip=True) if dd else ""

        # Use extract_price so pw → pcm conversion is applied for multi-room properties
        room_price_pcm = extract_price(price_text) if price_text else None
        if room_price_pcm is None:
            room_price_pcm = parse_money_to_int(price_text)

        rooms.append({
            "room_index": i,
            "price_pcm": room_price_pcm,
            "room_type": normalize_room_type(room_type_text),
        })
    return rooms

def extract_room_deposits(soup):
    """
    Extract deposits like:
      - Deposit (Room 1)
      - Security deposit (Room 2)
    Also extract generic:
      - Deposit
      - Security deposit
    Returns:
      (room_deposits_dict, generic_deposit_int_or_none)
    """
    room_deposits = {}
    generic_deposit = None

    extra = soup.select_one("section.feature--extra-cost dl.feature-list")
    if not extra:
        return room_deposits, generic_deposit

    keys = extra.find_all("dt", class_="feature-list__key")
    vals = extra.find_all("dd", class_="feature-list__value")

    for k, v in zip(keys, vals):
        ktxt = k.get_text(" ", strip=True) if k else ""
        vtxt = v.get_text(" ", strip=True) if v else ""

        k_lower = ktxt.lower()

        # Per-room: (security )deposit (room X)
        m = re.search(r"(security\s*)?deposit\s*\(room\s*(\d+)\)", k_lower, re.IGNORECASE)
        if m:
            room_idx = int(m.group(2))
            room_deposits[room_idx] = parse_money_to_int(vtxt)
            continue

        # Generic: Deposit / Security deposit (no room number)
        if "deposit" in k_lower:
            # prefer security deposit if multiple show up
            parsed = parse_money_to_int(vtxt)
            if parsed is not None:
                if generic_deposit is None:
                    generic_deposit = parsed
                elif "security" in k_lower:
                    generic_deposit = parsed

    return room_deposits, generic_deposit


def extract_whole_property_price(soup):
    """
    Find price from:
      <h3 class="feature__heading">£2,500 pcm <small>(whole property)</small></h3>
    Returns int price_pcm or None
    """
    for h in soup.select("h3.feature__heading"):
        txt = h.get_text(" ", strip=True)
        if "(whole property)" in txt.lower() or "whole property" in txt.lower():
            # Use your existing extract_price (handles commas and pw conversion)
            p = extract_price(txt)
            if p:
                return int(p)
    return None

def detect_whole_property(soup):
    """
    Detect whole property via '(whole property)' marker or 'This ad is for a ...' paragraph.
    Returns bool.
    """
    # strong marker
    for h in soup.select("h3.feature__heading"):
        if "whole property" in h.get_text(" ", strip=True).lower():
            return True

    # fallback: paragraph text
    for p in soup.select("p.feature__paragraph"):
        t = p.get_text(" ", strip=True).lower()
        if "this ad is for" in t and ("studio" in t or "bed" in t or "flat" in t or "apartment" in t or "house" in t):
            # not perfect, but usually whole property ads use this pattern
            return True

    return False

def extract_coordinates(lat_text, lon_text):
    """Extract and validate coordinates"""
    try:
        lat = float(lat_text) if lat_text and lat_text != "N/A" else None
        lon = float(lon_text) if lon_text and lon_text != "N/A" else None
        if lat is not None and (-90 <= lat <= 90):
            lat = round(lat, 8)
        else:
            lat = None
        if lon is not None and (-180 <= lon <= 180):
            lon = round(lon, 8)
        else:
            lon = None
        return lat, lon
    except:
        return None, None

def extract_feature_list(soup):
    """Extracts key-value pairs from feature-list <dl> blocks"""
    features = {}
    for dl in soup.find_all("dl", class_="feature-list"):
        keys = dl.find_all("dt", class_="feature-list__key")
        vals = dl.find_all("dd", class_="feature-list__value")

        for k, v in zip(keys, vals):
            key = clean_text(k.get_text()) if k else None
            val = clean_text(v.get_text()) if v else None

            # Handle tick/cross spans ("Yes"/"No")
            if v and v.find("span", class_="tick"):
                val = "Yes"
            elif v and v.find("span", class_="cross"):
                val = "No"

            if key:
                features[key] = val
    return features


def detect_property_type_from_key_features(soup):
    ul = soup.find("ul", class_="key-features")
    if not ul:
        return None, False

    items = ul.find_all("li", class_="key-features__feature")
    if not items:
        return None, False

    first = items[0].get_text(" ", strip=True).lower()

    # Anything "*share*" means room in shared property
    if "share" in first:
        return "Room", False

    # Anything "*to rent*" means whole property
    if "to rent" in first:
        return "Flat", True

    return None, False


def scrape_listing_advanced(url, paying, profile_flag=""):
    """Scrape one listing detail page.

    Returns (data, outcome) where outcome is one of:
      "ok"      — data is a row dict
      "skipped" — the page loaded and we deliberately dropped it (not accepting,
                  no photos); a truthful "this is not lettable right now"
      "error"   — we could not read the page at all; says nothing about the ad
    The caller needs the skipped/error distinction because only "error" means we
    cannot vouch for what the landlord currently has live.
    """
    try:
        resp = fetch_with_retry(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        html = resp.text
        if "The advertiser is not currently accepting applications" in html:
            print(f"🚫 Skipping {url} — advertiser not accepting applications.")
            return None, "skipped"
        # ✅ Whole property detection + dedicated price extraction
        is_whole_property = detect_whole_property(soup)
        whole_property_price = extract_whole_property_price(soup) if is_whole_property else None
        # ✅ Multi-room support (up to 6 rooms in one ad)
        room_options = extract_room_options(soup, max_rooms=6)  # list of rooms
        room_deposits, generic_deposit = extract_room_deposits(soup)            # dict {room_index: deposit}

        # attach deposits to room options
        for r in room_options:
            idx = r.get("room_index")
            if idx in room_deposits:
                r["deposit"] = room_deposits[idx]
            else:
                r["deposit"] = None

        room_count = len(room_options) if room_options else 1

        room_prices = [r.get("price_pcm") for r in room_options if r.get("price_pcm") is not None]
        min_room_price_pcm = min(room_prices) if room_prices else None
        max_room_price_pcm = max(room_prices) if room_prices else None
        # ✅ Recommended: if multi-room, make "price" = min room price for sorting in Sheets
        # and avoid using a single "deposit" field (ambiguous). Deposits will live in room{i}_deposit.
        if room_count > 1 and min_room_price_pcm is not None:
            # override listing-level price later after it's parsed too
            pass

        # Flatten room columns: only for the number of rooms in this listing (deposits/type/price only for rooms that exist)
        flat_rooms = {}
        for i in range(1, room_count + 1):
            flat_rooms[f"room{i}_type"] = ""
            flat_rooms[f"room{i}_price_pcm"] = ""
            flat_rooms[f"room{i}_deposit"] = ""

        for r in room_options:
            i = r.get("room_index")
            if i and 1 <= i <= room_count:
                flat_rooms[f"room{i}_type"] = r.get("room_type") or ""
                flat_rooms[f"room{i}_price_pcm"] = r.get("price_pcm") or ""
                flat_rooms[f"room{i}_deposit"] = r.get("deposit") or ""


        # Title
        title = "N/A"
        title_elem = soup.find("h1") or soup.find("h2") or soup.find("title")
        if title_elem:
            title = clean_text(title_elem.get_text())

        # Agent / Landlord name
        agent_name = None
        agent_elem = soup.find("strong", class_="profile-photo__name")
        if agent_elem:
            agent_name = clean_text(agent_elem.get_text())

       # Extract location (always the 2nd <li> inside .key-features)
        location = None
        key_features = soup.find("ul", class_="key-features")
        if key_features:
         items = key_features.find_all("li", class_="key-features__feature")
         if len(items) >= 2:
          location = items[1].get_text(strip=True)  # ✅ "Devons Road"


        # Latitude / Longitude
        latitude, longitude = "N/A", "N/A"
        script_tags = soup.find_all("script")
        for script in script_tags:
            if script.string:
                script_content = script.string
                lat_match = re.search(r'latitude["\s]*:["\s]*"?([0-9.-]+)"?', script_content)
                lon_match = re.search(r'longitude["\s]*:["\s]*"?([0-9.-]+)"?', script_content)
                if lat_match:
                    latitude = lat_match.group(1)
                if lon_match:
                    longitude = lon_match.group(1)
                location_match = re.search(
                    r'location["\s]*:["\s]*{[^}]*latitude["\s]*:["\s]*"?([0-9.-]+)"?[^}]*longitude["\s]*:["\s]*"?([0-9.-]+)"?',
                    script_content
                )
                if location_match:
                    latitude, longitude = location_match.group(1), location_match.group(2)

            all_photo_urls = []

            # ✅ Main image container
            main_gallery = soup.select_one("dl.photo-gallery__main-image-wrapper")
            if main_gallery:
                main_links = main_gallery.find_all("a", href=re.compile(
                    r"^https://photos2\.spareroom\.co\.uk/images/flatshare/listings/large/[0-9]+/[0-9]+/[0-9]+\.jpg$"
                ))
                for link in main_links:
                    photo_url = link.get("href")
                    if photo_url and photo_url not in all_photo_urls:
                        all_photo_urls.append(photo_url)

            # ✅ Thumbnail gallery container
            thumb_gallery = soup.select_one("div.photo-gallery__thumbnails")
            if thumb_gallery:
                thumb_links = thumb_gallery.find_all("a", href=re.compile(
                    r"^https://photos2\.spareroom\.co\.uk/images/flatshare/listings/large/[0-9]+/[0-9]+/[0-9]+\.jpg$"
                ))
                for link in thumb_links:
                    photo_url = link.get("href")
                    if photo_url and photo_url not in all_photo_urls:
                        all_photo_urls.append(photo_url)

            first_photo_url = all_photo_urls[0] if all_photo_urls else None
            photo_count = len(all_photo_urls)
            all_photos = ", ".join(all_photo_urls) if all_photo_urls else None
            # 🚫 Skip listings with NO images
            if photo_count == 0:
                print(f"🖼️ Skipping {url} — no images found.")
                return None, "skipped"

        # Price
        price = None
        price_selectors = [".price", ".rent", ".amount", "[class*='price']", "[class*='rent']", "[class*='amount']"]
        for selector in price_selectors:
            try:
                elements = soup.select(selector)
                for elem in elements:
                    text = elem.get_text(strip=True)
                    if '£' in text:
                        price = extract_price(text)
                        if price:
                            break
            except:
                continue
        # ✅ Always use whole-property header price if available
        if is_whole_property and whole_property_price is not None:
            price = int(whole_property_price)
        # ✅ If multi-room listing, use min room price as main price
        if room_count > 1 and min_room_price_pcm is not None:
            price = int(min_room_price_pcm)
        # ✅ Description (preserve emojis + newlines)
        description = None
        detaildesc_elem = soup.find("p", class_="detaildesc")
        if detaildesc_elem:
            description = extract_rich_text(detaildesc_elem)
        else:
            feature_desc_body = soup.find("div", class_="feature__description-body")
            if feature_desc_body:
                description = extract_rich_text(feature_desc_body)
            else:
                desc_selectors = [
                    ".description", ".details", ".content",
                    "[class*='description']", "[class*='details']",
                    "[class*='content']", "p", ".listing-details"
                ]
                for selector in desc_selectors:
                    try:
                        elements = soup.select(selector)
                        for elem in elements:
                            text = extract_rich_text(elem)
                            if text and len(text) > 50:
                                description = text
                                break
                        if description:
                            break
                    except:
                        continue

        # Property type (reliable) + whole property override
        property_type, is_whole_property_from_kf = detect_property_type_from_key_features(soup)

        # If key-features says "to rent", treat as whole property
        if is_whole_property_from_kf:
            is_whole_property = True  # overrides earlier detection


        # ✅ Extract structured features
        features = extract_feature_list(soup)
        available_date = features.get("Available")
        min_term = features.get("Minimum term")
        max_term = features.get("Maximum term")
                # ✅ Deposit can be "Deposit" or "Security deposit"
        deposit = features.get("Deposit")
        if not deposit:
            deposit = features.get("Security deposit")

        # If we found a numeric generic deposit in Extra cost,
        # use it ONLY for single-room listings
        if room_count == 1 and generic_deposit is not None:
            deposit = generic_deposit

        # If multi-room, listing-level deposit is ambiguous → clear it
        if room_count > 1:
            deposit = None
        bills_included = features.get("Bills included?")
        furnishings = features.get("Furnishings")
        parking = features.get("Parking")
        garden = features.get("Garden/patio")
        broadband = features.get("Broadband included")
        housemates = features.get("# housemates")
        total_rooms = features.get("Total # rooms")
        smoker = features.get("Smoker?")
        pets = features.get("Any pets?")
        occupation = features.get("Occupation")
        gender = features.get("Gender")
        couples_ok = features.get("Couples OK?")
        smoking_ok = features.get("Smoking OK?")
        pets_ok = features.get("Pets OK?")
        pref_occupation = features.get("Occupation")  # new housemate occupation
        references = features.get("References?")
        min_age = features.get("Min age")
        max_age = features.get("Max age")

        # Final result dictionary
        lat, lon = extract_coordinates(latitude, longitude)
        result = {
            "url": url,
            "title": title,
            "agent_name": agent_name,
            "location": location,
            "latitude": lat,
            "longitude": lon,
            "status": "available",
            "price": price,
            "description": description,  # ✅ emojis + newlines preserved
            "property_type": property_type,
            "available_date": available_date,
            "min_term": min_term,
            "max_term": max_term,
            "deposit": deposit,
            "bills_included": bills_included,
            "furnishings": furnishings,
            "parking": parking,
            "garden": garden,
            "broadband": broadband,
            "housemates": housemates,
            "total_rooms": total_rooms,
            "smoker": smoker,
            "pets": pets,
            "occupation": occupation,
            "gender": gender,
            "couples_ok": couples_ok,
            "smoking_ok": smoking_ok,
            "pets_ok": pets_ok,
            "pref_occupation": pref_occupation,
            "references": references,
            "min_age": min_age,
            "max_age": max_age,
            "photo_count": photo_count,
            "first_photo_url": first_photo_url,
            "all_photos": all_photos,
            "photos": json.dumps(all_photo_urls) if all_photo_urls else None,
            "paying": paying,
            "profile_flag": profile_flag,
            "flag": "",  # ✅ Will be populated from profile or manual flags
            "flag_color": "",  # ✅ Will be populated from profile or manual flags
            "room_count": room_count,
            "min_room_price_pcm": min_room_price_pcm,
            "max_room_price_pcm": max_room_price_pcm,
            **flat_rooms,  # room1_type, room1_price_pcm, room1_deposit ... only for rooms that exist
        }

        return result, "ok"
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
        return None, "error"


def main(listings, reached_landlord_ids):
    results = []
    seen_urls = set()  # ✅ track URLs already processed in this run
    # Landlords with at least one listing page we could not read. A read error
    # says nothing about whether the ad is still live, so these landlords are
    # dropped from the delete set below and keep the rows they already have.
    landlords_with_errors = set()

    for item in listings:
        url = item.get("url")
        paying = item.get("paying", "")
        profile_flag = item.get("profile_flag", "")

        if not url:
            continue

        # 🚫 Skip duplicate links inside listings list
        if url in seen_urls:
            print(f"🔁 Skipping duplicate in listings: {url}")
            continue

        seen_urls.add(url)

        print(f"Scraping {url}")
        if profile_flag:
            print(f"   📌 Applying profile flag: {profile_flag}")
        data, outcome = scrape_listing_advanced(url, paying, profile_flag)
        if outcome == "error" and item.get("landlord_id"):
            landlords_with_errors.add(item["landlord_id"])
        if data:
            data["landlord_id"] = item.get("landlord_id")
            results.append(data)

        time.sleep(1)

    # Landlords we can speak for: profile read to the end AND every listing page
    # under it either scraped or deliberately skipped. Only these are written and
    # only these are swept — including down to zero, which is the case the old
    # delete-only-what-we-inserted logic could never express, so a landlord whose
    # ads all came down kept serving them indefinitely.
    refreshed_landlord_ids = sorted(reached_landlord_ids - landlords_with_errors)

    # Nothing was read end-to-end, so there is nothing we can write and nothing we
    # are entitled to sweep. Bail BEFORE the summary line: callers key off that
    # line, and printing "posted 0" here would report "this landlord has nothing
    # live" when the truth is "we could not check". Scraped rows for landlords we
    # could not finish are deliberately dropped rather than written — see the
    # write set below.
    if not refreshed_landlord_ids:
        print("❌ No profile read cleanly end-to-end. Supabase not updated — "
              "existing listings left exactly as they were.")
        return

    # ========================================
    # POST TO SUPABASE scraped_listings
    # ========================================
    supabase_url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    tenant_id = os.environ.get("TENANT_ID")

    if not supabase_url or not supabase_key:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to post to Supabase.")
        return
    if not tenant_id:
        try:
            r0 = requests.get(
                f"{supabase_url}/rest/v1/tenants?select=id&limit=1",
                headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"},
                timeout=10,
            )
            if r0.ok and r0.json():
                tenant_id = r0.json()[0].get("id")
        except Exception:
            pass
    if not tenant_id:
        print("ERROR: Set TENANT_ID env var (no tenants found in Supabase fallback).")
        return

    try:
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
    except ImportError:
        print("ERROR: Install supabase: pip install supabase")
        return

    TABLE_COLS = [
        "tenant_id", "url", "title", "landlord_id", "location", "latitude", "longitude", "status", "price",
        "description", "property_type", "available_date", "min_term", "max_term", "deposit", "bills_included",
        "furnishings", "parking", "garden", "broadband", "housemates", "total_rooms", "smoker", "pets",
        "occupation", "gender", "couples_ok", "smoking_ok", "pets_ok", "pref_occupation", "references",
        "min_age", "max_age", "photo_count", "first_photo_url", "all_photos", "photos", "paying",
        "room_count", "min_room_price_pcm", "max_room_price_pcm",
        "room1_type", "room1_price_pcm", "room1_deposit", "room2_type", "room2_price_pcm", "room2_deposit",
        "room3_type", "room3_price_pcm", "room3_deposit", "room4_type", "room4_price_pcm", "room4_deposit",
    ]

    def _parse_date_for_db(val):
        if not val or not isinstance(val, str):
            return None
        s = val.strip()
        if not s:
            return None
        if re.match(r"^available\s+now", s, re.I):
            from datetime import date
            return date.today().isoformat()
        if re.match(r"^\d{4}-\d{2}-\d{2}", s):
            return s[:10]
        m = re.match(r"^(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{2,4})", s, re.I)
        if not m:
            return None
        day_str, month_str, year_str = m.group(1), m.group(2), m.group(3)
        months = "jan feb mar apr may jun jul aug sep oct nov dec"
        try:
            month_num = months.split().index(month_str.lower()[:3]) + 1
            day = int(day_str)
            year = int(year_str)
            if year < 100:
                year += 2000 if year < 50 else 1900
            if day < 1 or day > 31 or month_num < 1 or month_num > 12:
                return None
            return f"{year:04d}-{month_num:02d}-{day:02d}"
        except (ValueError, AttributeError, TypeError):
            return None

    NUMERIC_COLS = {
        "latitude", "longitude", "price", "deposit", "min_room_price_pcm", "max_room_price_pcm",
        "room1_price_pcm", "room1_deposit", "room2_price_pcm", "room2_deposit",
        "room3_price_pcm", "room3_deposit", "room4_price_pcm", "room4_deposit",
    }
    INT_COLS = {"photo_count", "room_count"}

    # One timestamp for the whole run, so every row written by this run shares a
    # scrape time and "when was this landlord last read" is a single clean value
    # rather than a spread across however long the run took.
    from datetime import datetime, timezone
    # "Z" rather than "+00:00": this value is also used as a filter value in the
    # sweep's `or=(...)` query string below, and a literal "+" there is liable to
    # be decoded as a space.
    scraped_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def _to_row(r):
        # source is set explicitly rather than left to the column default so the
        # rows we write match the source-scoped delete above exactly, and
        # last_seen_at records when this listing was last confirmed live.
        row = {
            "tenant_id": tenant_id,
            "source": "spareroom",
            "last_seen_at": scraped_at,
            # The upsert key. Without it every run would insert a new row and the
            # sweep would delete the previous one — which is the old
            # delete-then-insert cycle wearing a different name.
            "external_ref": spareroom_external_ref(r.get("url")),
        }
        for col in TABLE_COLS:
            if col == "tenant_id":
                continue
            val = r.get(col)
            if val is None or val == "":
                row[col] = None
            elif col == "available_date" and isinstance(val, str):
                row[col] = _parse_date_for_db(val)
            elif col in NUMERIC_COLS:
                try:
                    row[col] = float(val) if isinstance(val, (int, float)) else float(str(val).replace(",", ""))
                except (TypeError, ValueError):
                    row[col] = None
            elif col in INT_COLS:
                try:
                    row[col] = int(val)
                except (TypeError, ValueError):
                    row[col] = None
            else:
                row[col] = str(val).strip() if val is not None else None
        return row

    # ------------------------------------------------------------------
    # Write set == sweep set
    # ------------------------------------------------------------------
    # Only landlords we can speak for are written. Writing a landlord we are NOT
    # going to sweep is what let duplicates accumulate: their old rows survived
    # the delete and a fresh copy landed on top, once per partially-failing run.
    # Rows with no landlord_id are dropped for the same reason — nothing can ever
    # match, refresh or clear them, so writing them only creates litter.
    refreshed_set = set(refreshed_landlord_ids)
    writable = [r for r in results if r.get("landlord_id") in refreshed_set]
    held_back = len(results) - len(writable)

    # Collapse to one row per (landlord, advert). Two URLs can carry the same
    # advert id — the sidebar fallback and profile pagination produce different
    # query strings for the same ad — and the earlier dedupe is by full URL, so it
    # does not catch them. Postgres rejects an upsert that touches the same
    # conflict key twice in one statement, so this is required, not defensive.
    rows = []
    seen_refs = set()
    for r in writable:
        row = _to_row(r)
        key = (row.get("landlord_id"), row.get("external_ref"))
        if key in seen_refs:
            continue
        seen_refs.add(key)
        rows.append(row)

    landlords_with_rows = {r.get("landlord_id") for r in rows if r.get("landlord_id")}

    # Upsert, don't replace. Matching on (landlord_id, external_ref) updates the
    # existing row in place, so its id survives — and with it every
    # leads.listing_id pointing at it, which delete-then-insert severed nightly.
    for i in range(0, len(rows), 100):
        supabase.table("scraped_listings").upsert(
            rows[i : i + 100], on_conflict="landlord_id,external_ref"
        ).execute()

    # ------------------------------------------------------------------
    # Sweep: rows that were here yesterday and are not live today
    # ------------------------------------------------------------------
    # Everything still live was just stamped with this run's timestamp, so an
    # older last_seen_at means "we read this landlord end-to-end and this listing
    # was not among their live ads". Sweeping AFTER the write, rather than
    # deleting before it, is what makes a crash mid-run harmless: it leaves
    # yesterday's data in place instead of nothing.
    #
    # Scoped to source='spareroom' so a landlord who also has a listings
    # spreadsheet keeps their imported rows. Null last_seen_at is included: those
    # rows predate freshness tracking, so they cannot have been seen this run.
    swept = 0
    for i in range(0, len(refreshed_landlord_ids), 100):
        chunk = refreshed_landlord_ids[i : i + 100]
        res = (
            supabase.table("scraped_listings")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("source", "spareroom")
            .in_("landlord_id", chunk)
            .or_(f"last_seen_at.lt.{scraped_at},last_seen_at.is.null")
            .execute()
        )
        swept += len(getattr(res, "data", None) or [])

    # Stamp the read time on the landlord itself, so "this landlord's listings are
    # months old" is visible in the app without inferring it from row timestamps.
    # Only landlords we actually read are stamped — a landlord we failed to reach
    # keeps its previous value, which is what makes the staleness visible.
    for i in range(0, len(refreshed_landlord_ids), 100):
        chunk = refreshed_landlord_ids[i : i + 100]
        supabase.table("landlords").update({"last_scraped_at": scraped_at}).eq(
            "tenant_id", tenant_id
        ).in_("id", chunk).execute()

    # ------------------------------------------------------------------
    # Orphan sweep: rows no landlord-scoped sweep can ever reach
    # ------------------------------------------------------------------
    # Two classes are invisible to the sweep above because they are not in the
    # roster: rows whose landlord_id is NULL (their landlord row was deleted —
    # the FK is `on delete set null`), and rows belonging to a landlord who has
    # since had their spareroom_profile_url cleared. Neither can ever be refreshed
    # again, so left alone they are served as live for good.
    #
    # Guarded twice, because this is the one delete not backed by having just read
    # the source:
    #   * only on a full-roster run — a single-landlord run (LANDLORD_ID set)
    #     loads one profile and knows nothing about who else is on the roster
    #   * only when at least half the roster read cleanly — a run where SpareRoom
    #     was blocking us is not evidence about anything
    orphans_swept = 0
    derostered_swept = 0
    roster_ids = {lid for lid in landlord_ids if lid}
    healthy = bool(roster_ids) and len(refreshed_set) * 2 >= len(roster_ids)

    if landlord_id_filter:
        print("   ↷ Orphan sweep skipped — a single-landlord run has no view of the roster.")
    elif not healthy:
        print(f"   ↷ Orphan sweep skipped — only {len(refreshed_set)} of {len(roster_ids)} "
              "landlords read cleanly, too little of the roster to act on.")
    else:
        res = (
            supabase.table("scraped_listings")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("source", "spareroom")
            .is_("landlord_id", "null")
            .execute()
        )
        orphans_swept = len(getattr(res, "data", None) or [])

        # Landlords still holding rows but no longer on the roster. Paged because
        # PostgREST has no DISTINCT and a default page size we should not assume.
        present = set()
        page = 0
        while True:
            res = (
                supabase.table("scraped_listings")
                .select("landlord_id")
                .eq("tenant_id", tenant_id)
                .eq("source", "spareroom")
                .not_.is_("landlord_id", "null")
                .range(page * 1000, page * 1000 + 999)
                .execute()
            )
            batch = getattr(res, "data", None) or []
            present.update(r["landlord_id"] for r in batch if r.get("landlord_id"))
            if len(batch) < 1000:
                break
            page += 1

        derostered = sorted(present - roster_ids)
        for i in range(0, len(derostered), 100):
            chunk = derostered[i : i + 100]
            res = (
                supabase.table("scraped_listings")
                .delete()
                .eq("tenant_id", tenant_id)
                .eq("source", "spareroom")
                .in_("landlord_id", chunk)
                .execute()
            )
            derostered_swept += len(getattr(res, "data", None) or [])
        if derostered:
            print(f"   🧹 {len(derostered)} landlord(s) no longer have a SpareRoom profile "
                  f"URL — {derostered_swept} of their rows removed.")

    print(f"\n✅ Successfully posted {len(rows)} listings to Supabase scraped_listings!")
    print(f"   👤 Landlords refreshed: {len(refreshed_landlord_ids)} of {len(LANDLORD_NAME_BY_ID)} loaded")
    print(f"   🧹 Swept {swept} listing(s) no longer live at source"
          + (f", {orphans_swept} orphaned row(s) with no landlord" if orphans_swept else "")
          + (f", {derostered_swept} row(s) from de-rostered landlords" if derostered_swept else ""))
    if held_back:
        print(f"   ⏸ {held_back} scraped listing(s) not written — their landlord could not be "
              "read end-to-end, so writing them would mean writing rows nothing will ever clear.")

    # Refreshed but empty: read cleanly, nothing live. Their stale rows have just
    # been cleared — this is the case that used to go unnoticed and leave months
    # of dead listings being served.
    cleared = [
        (lid, LANDLORD_NAME_BY_ID.get(lid) or "(no name)")
        for lid in refreshed_landlord_ids
        if lid not in landlords_with_rows
    ]
    if cleared:
        print(f"   🧹 {len(cleared)} landlords read cleanly with 0 live listings — their old rows were removed:")
        for lid, name in cleared:
            print(f"      - {name} ({lid})")

    # Not reached: URL unrecognised, profile fetch failed, pagination broke, or a
    # listing page errored. We cannot vouch for these, so their rows are left as
    # they were — which means they are the ones that go stale. Chase these.
    unreachable = [
        (lid, LANDLORD_NAME_BY_ID.get(lid) or "(no name)")
        for lid in LANDLORD_NAME_BY_ID
        if lid not in refreshed_set
    ]
    if unreachable:
        print(f"   ⚠️ {len(unreachable)} landlords could not be read — existing rows left untouched and will age:")
        for lid, name in unreachable:
            print(f"      - {name} ({lid})")
        print("     Likely causes: profile URL unrecognised, profile blocked/erroring, or a listing page failed to load.")


# Call main() to scrape each individual listing
if __name__ == "__main__":
    main(listings, reached_landlord_ids)