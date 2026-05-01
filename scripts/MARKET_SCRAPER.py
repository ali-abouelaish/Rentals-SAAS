"""
SpareRoom market scraper — duplicate of OGSCRPAPER.py adapted for postcode-anchored
area searches. Parses SpareRoom search-results pages instead of landlord profiles
and writes to `market_listings` (shared across tenants).

Helper functions are copied verbatim from OGSCRPAPER.py so this script has zero
runtime dependency on the original — both can run independently.

Env vars:
  APP_URL (or NEXT_PUBLIC_APP_URL)        — base URL of the Next.js app
  SCRAPER_API_KEY                          — bearer auth for the search-targets endpoint
  NEXT_PUBLIC_SUPABASE_URL                 — Supabase URL
  SUPABASE_SERVICE_ROLE_KEY                — Supabase service-role key
  MARKET_RADIUS_MILES                      — optional override (default 3)
"""

import json
import os
import re
import sys
import time
from urllib.parse import urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

# Load .env.local / .env
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

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# -----------------------------
# 1) Load search targets from the app
# -----------------------------

app_url = (os.environ.get("APP_URL") or os.environ.get("NEXT_PUBLIC_APP_URL") or "").strip().rstrip("/")
api_key = os.environ.get("SCRAPER_API_KEY")
radius_miles = os.environ.get("MARKET_RADIUS_MILES", "1").strip() or "1"

if not app_url or not api_key:
    raise SystemExit("Set APP_URL and SCRAPER_API_KEY in env.")

_targets_resp = requests.get(
    f"{app_url}/api/market/spareroom-search-targets?radius_miles={radius_miles}",
    headers={"Authorization": f"Bearer {api_key}"},
    timeout=15,
)
if not _targets_resp.ok:
    print(f"API error {_targets_resp.status_code}: {_targets_resp.text[:500]}", file=sys.stderr)
    raise SystemExit(f"Search-targets API returned {_targets_resp.status_code}.")

try:
    _targets_data = _targets_resp.json()
except Exception as e:
    raise SystemExit("Search-targets API did not return JSON.") from e

searches = _targets_data.get("searches", [])
print(f"Loaded {len(searches)} postcode search targets (radius={radius_miles} miles)")

# -----------------------------
# 2) HTTP session + retry helper (copied from OGSCRPAPER.py)
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
try:
    session.get(base_url, timeout=10)
except Exception:
    pass


def fetch_with_retry(url, max_attempts=4, timeout=15):
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


# -----------------------------
# 3) Walk each search URL, harvest listing URLs
# -----------------------------

def extract_search_listing_urls(soup):
    """Pull listing URLs from a SpareRoom search-results page.

    SpareRoom search results (modern markup) wrap each result in
    `article.panel-listing-result` with anchors of class `listingResult`,
    or in `<li class="listing-result">` for older markup. We also fall
    back to any anchor whose href contains `flatshare_detail.pl`.
    """
    urls = []

    # Modern: <article class="panel panel-listing-result"><header><a class="listingResult" href="...">
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Only listing detail URLs — search results, profile pages, ads etc. are skipped
        if "/flatshare/flatshare_detail.pl" in href:
            full = href if href.startswith("http") else base_url + href
            # Strip search_results query suffix so the same listing doesn't appear twice
            full = full.split("&search_id=")[0]
            urls.append(full)

    # Older listing-card markup (used on profile pages — keeping for safety)
    for a in soup.find_all("a", class_="listing-card__link"):
        href = a.get("href")
        if href:
            full = href if href.startswith("http") else base_url + href
            urls.append(full)

    # Dedupe while preserving order
    seen = set()
    deduped = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            deduped.append(u)
    return deduped


all_results = []  # [{ url, postcode_searched, radius_miles_searched, source_search_url }]

for search in searches:
    postcode = search.get("postcode")
    search_url = search.get("url")
    radius = search.get("radius_miles", 3)

    if not postcode or not search_url:
        continue

    print(f"\n🔍 Searching SpareRoom for {postcode} (radius={radius}mi)")
    offset = 0
    prev_page_links = set()
    page_count = 0
    postcode_collected = 0

    # Cap pagination to keep the run bounded. ~10 pages × ~20 listings = 200 max per postcode.
    MAX_PAGES = int(os.environ.get("MARKET_MAX_PAGES_PER_POSTCODE", "10"))

    while page_count < MAX_PAGES:
        page_url = (
            f"{search_url}&offset={offset}" if "?" in search_url else f"{search_url}?offset={offset}"
        )
        try:
            response = fetch_with_retry(page_url)
            soup = BeautifulSoup(response.text, "html.parser")
            listing_urls = extract_search_listing_urls(soup)
            print(f"   page {page_count + 1}: offset={offset}, found {len(listing_urls)} listings")

            if not listing_urls:
                if page_count == 0:
                    # Diagnostic on truly-empty first page
                    print(f"   body preview: {response.text[:200].replace(chr(10), ' ')}...")
                break
            current_page_links = set(listing_urls)
            if current_page_links == prev_page_links:
                print(f"   no new listings on page {page_count + 1} — stopping pagination")
                break
            for url in current_page_links:
                all_results.append({
                    "url": url,
                    "postcode_searched": postcode,
                    "radius_miles_searched": float(radius) if radius is not None else None,
                    "source_search_url": search_url,
                })
            postcode_collected += len(current_page_links)
            prev_page_links = current_page_links
            offset += 10
            page_count += 1
            time.sleep(1.5)
        except Exception as e:
            print(f"⚠️ Error fetching {page_url}: {e}")
            break

    print(f"   ✅ {postcode}: collected {postcode_collected} listings across {page_count} page(s)")

# Deduplicate by URL — last write wins on postcode_searched
seen = {}
for item in all_results:
    seen[item["url"]] = item  # later entries overwrite earlier
listings = list(seen.values())
print(f"\n✅ Collected {len(listings)} unique listing URLs across {len(searches)} searches")

# -----------------------------
# 4) Per-listing parsing (copied verbatim from OGSCRPAPER.py)
# -----------------------------


def clean_text(text):
    if not text or text == "N/A":
        return None
    text = re.sub(r"\s+", " ", text.strip())
    text = re.sub(r"<[^>]+>", "", text)
    if len(text) > 500:
        text = text[:500] + "..."
    return text


def extract_rich_text(elem):
    if not elem:
        return None
    for br in elem.find_all("br"):
        br.replace_with("\n")
    text = elem.get_text().strip()
    return text if text else None


def extract_price(price_text):
    if not price_text or price_text == "N/A":
        return None
    price_match = re.search(r"£?(\d+(?:,\d+)?(?:\.\d{2})?)", str(price_text))
    if price_match:
        price = price_match.group(1).replace(",", "")
        try:
            price = float(price)
            text_lower = price_text.lower()
            if "pw" in text_lower or "per week" in text_lower:
                price = round(price * 52 / 12)
            else:
                price = round(price)
            return int(price)
        except Exception:
            return None
    return None


def parse_money_to_int(text):
    if not text:
        return None
    m = re.search(r"£\s*([0-9][0-9,]*)(?:\.\d{2})?", str(text))
    if not m:
        return None
    return int(m.group(1).replace(",", ""))


def normalize_room_type(text):
    if not text:
        return None
    t = text.strip().lower()
    if "en-suite" in t or "ensuite" in t or "en suite" in t:
        return "ensuite"
    if "single" in t:
        return "single"
    if "double" in t:
        return "double"
    if "studio" in t:
        return "studio"
    return t


def extract_room_options(soup, max_rooms=6):
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
        m = re.search(r"(security\s*)?deposit\s*\(room\s*(\d+)\)", k_lower, re.IGNORECASE)
        if m:
            room_idx = int(m.group(2))
            room_deposits[room_idx] = parse_money_to_int(vtxt)
            continue
        if "deposit" in k_lower:
            parsed = parse_money_to_int(vtxt)
            if parsed is not None:
                if generic_deposit is None:
                    generic_deposit = parsed
                elif "security" in k_lower:
                    generic_deposit = parsed
    return room_deposits, generic_deposit


def extract_whole_property_price(soup):
    for h in soup.select("h3.feature__heading"):
        txt = h.get_text(" ", strip=True)
        if "(whole property)" in txt.lower() or "whole property" in txt.lower():
            p = extract_price(txt)
            if p:
                return int(p)
    return None


def detect_whole_property(soup):
    for h in soup.select("h3.feature__heading"):
        if "whole property" in h.get_text(" ", strip=True).lower():
            return True
    for p in soup.select("p.feature__paragraph"):
        t = p.get_text(" ", strip=True).lower()
        if "this ad is for" in t and ("studio" in t or "bed" in t or "flat" in t or "apartment" in t or "house" in t):
            return True
    return False


def extract_feature_list(soup):
    features = {}
    for dl in soup.find_all("dl", class_="feature-list"):
        keys = dl.find_all("dt", class_="feature-list__key")
        vals = dl.find_all("dd", class_="feature-list__value")
        for k, v in zip(keys, vals):
            key = clean_text(k.get_text()) if k else None
            val = clean_text(v.get_text()) if v else None
            if v and v.find("span", class_="tick"):
                val = "Yes"
            elif v and v.find("span", class_="cross"):
                val = "No"
            if key:
                features[key] = val
    return features


def extract_coordinates(soup):
    """Pull latitude/longitude from the listing's embedded JS blocks."""
    latitude, longitude = None, None
    for script in soup.find_all("script"):
        if not script.string:
            continue
        content = script.string
        location_match = re.search(
            r'location["\s]*:["\s]*{[^}]*latitude["\s]*:["\s]*"?([0-9.-]+)"?[^}]*longitude["\s]*:["\s]*"?([0-9.-]+)"?',
            content,
        )
        if location_match:
            try:
                lat = float(location_match.group(1))
                lon = float(location_match.group(2))
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    return round(lat, 8), round(lon, 8)
            except ValueError:
                pass
        if latitude is None:
            m = re.search(r'latitude["\s]*:["\s]*"?([0-9.-]+)"?', content)
            if m:
                try:
                    val = float(m.group(1))
                    if -90 <= val <= 90:
                        latitude = round(val, 8)
                except ValueError:
                    pass
        if longitude is None:
            m = re.search(r'longitude["\s]*:["\s]*"?([0-9.-]+)"?', content)
            if m:
                try:
                    val = float(m.group(1))
                    if -180 <= val <= 180:
                        longitude = round(val, 8)
                except ValueError:
                    pass
    return latitude, longitude


def detect_property_type_from_key_features(soup):
    ul = soup.find("ul", class_="key-features")
    if not ul:
        return None, False
    items = ul.find_all("li", class_="key-features__feature")
    if not items:
        return None, False
    first = items[0].get_text(" ", strip=True).lower()
    if "share" in first:
        return "Room", False
    if "to rent" in first:
        return "Flat", True
    return None, False


# Extract postcode outward (e.g. "E1", "E14", "SW1A") from free-text.
POSTCODE_OUTWARD_RE = re.compile(r"\b([A-Z]{1,2}[0-9][A-Z0-9]?)\b")


def extract_postcode_outward(*texts):
    for txt in texts:
        if not txt:
            continue
        m = POSTCODE_OUTWARD_RE.search(str(txt).upper())
        if m:
            return m.group(1)
    return None


def scrape_listing_advanced(url):
    try:
        resp = fetch_with_retry(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        html = resp.text
        if "The advertiser is not currently accepting applications" in html:
            print(f"🚫 Skipping {url} — advertiser not accepting applications.")
            return None

        is_whole_property = detect_whole_property(soup)
        whole_property_price = extract_whole_property_price(soup) if is_whole_property else None

        room_options = extract_room_options(soup, max_rooms=6)
        room_deposits, generic_deposit = extract_room_deposits(soup)
        for r in room_options:
            idx = r.get("room_index")
            r["deposit"] = room_deposits.get(idx)

        room_count = len(room_options) if room_options else 1
        room_prices = [r.get("price_pcm") for r in room_options if r.get("price_pcm") is not None]
        min_room_price_pcm = min(room_prices) if room_prices else None
        max_room_price_pcm = max(room_prices) if room_prices else None

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

        title = "N/A"
        title_elem = soup.find("h1") or soup.find("h2") or soup.find("title")
        if title_elem:
            title = clean_text(title_elem.get_text())

        location = None
        key_features = soup.find("ul", class_="key-features")
        if key_features:
            items = key_features.find_all("li", class_="key-features__feature")
            if len(items) >= 2:
                location = items[1].get_text(strip=True)

        all_photo_urls = []
        main_gallery = soup.select_one("dl.photo-gallery__main-image-wrapper")
        if main_gallery:
            for link in main_gallery.find_all("a", href=re.compile(
                r"^https://photos2\.spareroom\.co\.uk/images/flatshare/listings/large/[0-9]+/[0-9]+/[0-9]+\.jpg$"
            )):
                photo_url = link.get("href")
                if photo_url and photo_url not in all_photo_urls:
                    all_photo_urls.append(photo_url)
        thumb_gallery = soup.select_one("div.photo-gallery__thumbnails")
        if thumb_gallery:
            for link in thumb_gallery.find_all("a", href=re.compile(
                r"^https://photos2\.spareroom\.co\.uk/images/flatshare/listings/large/[0-9]+/[0-9]+/[0-9]+\.jpg$"
            )):
                photo_url = link.get("href")
                if photo_url and photo_url not in all_photo_urls:
                    all_photo_urls.append(photo_url)

        first_photo_url = all_photo_urls[0] if all_photo_urls else None
        photo_count = len(all_photo_urls)
        all_photos = ", ".join(all_photo_urls) if all_photo_urls else None
        if photo_count == 0:
            print(f"🖼️ Skipping {url} — no images found.")
            return None

        price = None
        for selector in [".price", ".rent", ".amount", "[class*='price']", "[class*='rent']", "[class*='amount']"]:
            try:
                for elem in soup.select(selector):
                    text = elem.get_text(strip=True)
                    if "£" in text:
                        p = extract_price(text)
                        if p:
                            price = p
                            break
                if price:
                    break
            except Exception:
                continue
        if is_whole_property and whole_property_price is not None:
            price = int(whole_property_price)
        if room_count > 1 and min_room_price_pcm is not None:
            price = int(min_room_price_pcm)

        description = None
        detaildesc_elem = soup.find("p", class_="detaildesc")
        if detaildesc_elem:
            description = extract_rich_text(detaildesc_elem)
        else:
            feature_desc_body = soup.find("div", class_="feature__description-body")
            if feature_desc_body:
                description = extract_rich_text(feature_desc_body)

        property_type, is_whole_property_from_kf = detect_property_type_from_key_features(soup)
        if is_whole_property_from_kf:
            is_whole_property = True

        features = extract_feature_list(soup)
        deposit = features.get("Deposit") or features.get("Security deposit")
        if room_count == 1 and generic_deposit is not None:
            deposit = generic_deposit
        if room_count > 1:
            deposit = None

        postcode_outward = extract_postcode_outward(location, title)
        latitude, longitude = extract_coordinates(soup)

        return {
            "url": url,
            "title": title,
            "location_text": location,
            "postcode_outward": postcode_outward,
            "latitude": latitude,
            "longitude": longitude,
            "status": "available",
            "price": price,
            "description": description,
            "property_type": property_type,
            "available_date": features.get("Available"),
            "min_term": features.get("Minimum term"),
            "max_term": features.get("Maximum term"),
            "deposit": deposit,
            "bills_included": features.get("Bills included?"),
            "furnishings": features.get("Furnishings"),
            "parking": features.get("Parking"),
            "garden": features.get("Garden/patio"),
            "broadband": features.get("Broadband included"),
            "housemates": features.get("# housemates"),
            "total_rooms": features.get("Total # rooms"),
            "smoker": features.get("Smoker?"),
            "pets": features.get("Any pets?"),
            "occupation": features.get("Occupation"),
            "gender": features.get("Gender"),
            "couples_ok": features.get("Couples OK?"),
            "smoking_ok": features.get("Smoking OK?"),
            "pets_ok": features.get("Pets OK?"),
            "pref_occupation": features.get("Occupation"),
            "references": features.get("References?"),
            "min_age": features.get("Min age"),
            "max_age": features.get("Max age"),
            "photo_count": photo_count,
            "first_photo_url": first_photo_url,
            "all_photos": all_photos,
            "photos": json.dumps(all_photo_urls) if all_photo_urls else None,
            "room_count": room_count,
            "min_room_price_pcm": min_room_price_pcm,
            "max_room_price_pcm": max_room_price_pcm,
            **flat_rooms,
        }
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
        return None


# -----------------------------
# 5) Scrape each listing + post to Supabase
# -----------------------------


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


TABLE_COLS = [
    "url", "title", "description", "location_text", "postcode_searched", "radius_miles_searched",
    "postcode_outward", "latitude", "longitude", "property_type", "status", "price", "available_date", "min_term", "max_term",
    "deposit", "bills_included", "furnishings", "parking", "garden", "broadband", "housemates",
    "total_rooms", "smoker", "pets", "occupation", "gender", "couples_ok", "smoking_ok", "pets_ok",
    "pref_occupation", "references", "min_age", "max_age", "photo_count", "first_photo_url",
    "all_photos", "photos", "room_count", "min_room_price_pcm", "max_room_price_pcm",
    "room1_type", "room1_price_pcm", "room1_deposit", "room2_type", "room2_price_pcm", "room2_deposit",
    "room3_type", "room3_price_pcm", "room3_deposit", "room4_type", "room4_price_pcm", "room4_deposit",
    "source_search_url", "scraped_at",
]
NUMERIC_COLS = {
    "radius_miles_searched", "latitude", "longitude", "price", "deposit", "min_room_price_pcm", "max_room_price_pcm",
    "room1_price_pcm", "room1_deposit", "room2_price_pcm", "room2_deposit",
    "room3_price_pcm", "room3_deposit", "room4_price_pcm", "room4_deposit",
}
INT_COLS = {"photo_count", "room_count"}


def _to_row(r, search_meta):
    from datetime import datetime, timezone
    row = {}
    merged = {**search_meta, **r}
    merged["scraped_at"] = datetime.now(timezone.utc).isoformat()
    for col in TABLE_COLS:
        val = merged.get(col)
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


def main():
    if not listings:
        print("❌ No listing URLs collected; nothing to scrape.")
        return

    supabase_url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        return

    try:
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
    except ImportError:
        print("ERROR: Install supabase: pip install supabase")
        return

    rows = []
    for item in listings:
        url = item["url"]
        print(f"Scraping {url}")
        data = scrape_listing_advanced(url)
        if not data:
            continue
        search_meta = {
            "postcode_searched": item["postcode_searched"],
            "radius_miles_searched": item.get("radius_miles_searched"),
            "source_search_url": item.get("source_search_url"),
        }
        rows.append(_to_row(data, search_meta))
        time.sleep(1)

    if not rows:
        print("❌ No listings scraped.")
        return

    # Upsert by URL — last write wins
    for i in range(0, len(rows), 100):
        chunk = rows[i : i + 100]
        supabase.table("market_listings").upsert(chunk, on_conflict="url").execute()
    print(f"\n✅ Successfully upserted {len(rows)} listings to market_listings!")


if __name__ == "__main__":
    main()
