import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import sys
import os

# Load .env.local / .env so APP_URL, SCRAPER_API_KEY, TENANT_ID are set when run from project root
try:
    from dotenv import load_dotenv
    # Project root: parent of directory containing this script
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
    # Try to set UTF-8 encoding
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        # If that fails, just replace emojis with text
        pass

# -----------------------------
# 1) Load profiles from public Google Sheet
# -----------------------------

# Load profiles from landlord profiles (app API)
import os
import requests

app_url = (os.environ.get("APP_URL") or os.environ.get("NEXT_PUBLIC_APP_URL") or "").strip().rstrip("/")
tenant_id = os.environ.get("TENANT_ID")
api_key = os.environ.get("SCRAPER_API_KEY")
# If TENANT_ID missing, try to get first tenant from Supabase (dev convenience)
if not tenant_id and os.environ.get("NEXT_PUBLIC_SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
    try:
        supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
        sr_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        r0 = requests.get(
            f"{supabase_url}/rest/v1/tenants?select=id&limit=1",
            headers={"apikey": sr_key, "Authorization": f"Bearer {sr_key}"},
            timeout=10,
        )
        if r0.ok and r0.json():
            tenant_id = r0.json()[0].get("id")
    except Exception:
        pass
if not app_url or not tenant_id or not api_key:
    raise SystemExit("Set APP_URL, SCRAPER_API_KEY and TENANT_ID in env (or Supabase vars for tenant fallback).")

r = requests.get(
    f"{app_url}/api/landlords/spareroom-profiles?tenant_id={tenant_id}",
    headers={"Authorization": f"Bearer {api_key}"},
    timeout=15,
)
if not r.ok:
    print(f"API error {r.status_code}: {r.text[:500]}", file=sys.stderr)
    raise SystemExit(f"Profiles API returned {r.status_code}. Is the app running at {app_url}?")
try:
    data = r.json()
except Exception as e:
    print(f"API response was not JSON. Status: {r.status_code}", file=sys.stderr)
    print(f"Response (first 500 chars): {r.text[:500]}", file=sys.stderr)
    raise SystemExit("Profiles API did not return JSON. Is the Next.js app running?") from e
profiles = data.get("profiles", [])
paying_flags = (data.get("paying_flags") or [""] * len(profiles))[: len(profiles)]
property_flags = (data.get("profile_flags") or [""] * len(profiles))[: len(profiles)]
landlord_ids = (data.get("ids") or [""] * len(profiles))[: len(profiles)]
# -----------------------------
# 2) Scraper setup
# -----------------------------
base_url = "https://www.spareroom.co.uk"
headers = {"User-Agent": "Mozilla/5.0"}

all_results = []   # ← this is now your main array

# -----------------------------
# 3) Scrape each profile
# -----------------------------
for profile_url, paying_flag, property_flag, landlord_id in zip(profiles, paying_flags, property_flags, landlord_ids):
    print(f"\n🔍 Scraping profile: {profile_url}")
    offset = 0
    prev_page_links = set()

    while True:
        page_url = (
            f"{profile_url}?offset={offset}"
            if "?" not in profile_url
            else f"{profile_url}&offset={offset}"
        )

        try:
            response = requests.get(page_url, headers=headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            listings = soup.find_all("a", class_="listing-card__link")
            if not listings:
                break

            current_page_links = set()

            for a in listings:
                href = a.get("href")
                if href:
                    full_url = href if href.startswith("http") else base_url + href
                    current_page_links.add(full_url)

            if current_page_links == prev_page_links:
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




import requests
from bs4 import BeautifulSoup
import re
import time
import json
import gspread
import pandas as pd
import os
from google.oauth2.service_account import Credentials

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Get the project root (parent directory of scripts folder)
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
# Credentials: env var first (so you can put the file anywhere), then default paths
_env_creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH")
SERVICE_ACCOUNT_PATHS = []
if _env_creds and os.path.isfile(_env_creds):
    SERVICE_ACCOUNT_PATHS.append(_env_creds)
SERVICE_ACCOUNT_PATHS.extend([
    os.path.join(PROJECT_ROOT, "storage", "app", "google-credentials.json"),
    os.path.join(PROJECT_ROOT, "credentials", "service_account.json"),
    os.path.join(PROJECT_ROOT, "storage", "app", "service_account.json"),
])

SERVICE_ACCOUNT_FILE = None
for path in SERVICE_ACCOUNT_PATHS:
    if os.path.exists(path):
        SERVICE_ACCOUNT_FILE = path
        print(f"Found credentials at: {path}")
        break

# Optional: Google Sheets (script now posts to Supabase only)
gc = None
sheet = None
if SERVICE_ACCOUNT_FILE:
    try:
        SCOPES = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        gc = gspread.authorize(creds)
        sheet = gc.open_by_key("1qkiVKv8HimkCznrxMvJVNSz-l9yNWkD0kQ2KYRlqV18").worksheet("Properties")
        print("Google Sheets connected (optional).")
    except Exception as e:
        print(f"Google Sheets skip: {e}")
else:
    print("(Posting to Supabase only; no Google credentials.)")

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
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        }
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        html = resp.text
        if "The advertiser is not currently accepting applications" in html:
            print(f"🚫 Skipping {url} — advertiser not accepting applications.")
            return None
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
                return None

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

        # Property type
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
            "room_count": room_count,
            "min_room_price_pcm": min_room_price_pcm,
            "max_room_price_pcm": max_room_price_pcm,
            **flat_rooms,  # room1_type, room1_price_pcm, room1_deposit ... only for rooms that exist
        }

        return result
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
        return None


def main(listings):
    results = []
    seen_urls = set()  # ✅ track URLs already processed in this run

    for item in listings:
        url = item.get("url")
        paying = item.get("paying", "")

        if not url:
            continue

        # 🚫 Skip duplicate links inside listings list
        if url in seen_urls:
            print(f"🔁 Skipping duplicate in listings: {url}")
            continue

        seen_urls.add(url)

        print(f"Scraping {url}")
        data = scrape_listing_advanced(url, paying, "")
        if data:
            data["landlord_id"] = item.get("landlord_id")
            data["tenant_id"] = tenant_id
            results.append(data)

        time.sleep(1)

    # Convert to DataFrame (kept for any legacy use; we now post to Supabase)
    df_output = pd.DataFrame(results)

    # SAFETY CHECK
    if df_output.empty:
        print("❌ No listings scraped. Supabase not updated.")
        return

    # ========================================
    # POST TO SUPABASE scraped_listings
    # ========================================
    supabase_url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to post to Supabase.")
        return

    try:
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
    except ImportError:
        print("ERROR: Install supabase: pip install supabase")
        return

    # Flags are set from the dashboard on the landlord profile; scraper does not set or preserve them.

    # 4b️⃣ Drop columns that are entirely null or empty (only show columns with at least one value)
    def _is_empty(val):
        if pd.isna(val):
            return True
        s = str(val).strip()
        return s == "" or s.lower() in ("nan", "none", "n/a")

    cols_to_drop = [c for c in df_output.columns if df_output[c].apply(_is_empty).all()]
    if cols_to_drop:
        df_output = df_output.drop(columns=cols_to_drop)
        print(f"\n📋 Dropped {len(cols_to_drop)} empty columns: {', '.join(cols_to_drop)}")

    # 5️⃣ Ensure headers match dataframe (strip any leading/trailing spaces)
    df_output.columns = [str(c).strip() for c in df_output.columns]
    df_headers = df_output.columns.tolist()
    
    print(f"\n📋 Posting {len(results)} rows to Supabase scraped_listings")

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
        """Parse SpareRoom-style dates (e.g. '1st Dec 20', '15th Jan 21', 'Available now') to YYYY-MM-DD or None."""
        if not val or not isinstance(val, str):
            return None
        s = val.strip()
        if not s:
            return None
        # "Available now" / "available now" -> use today
        if re.match(r"^available\s+now", s, re.I):
            from datetime import date
            return date.today().isoformat()
        # Already ISO-like (YYYY-MM-DD)
        if re.match(r"^\d{4}-\d{2}-\d{2}", s):
            return s[:10]
        # e.g. "1st Dec 20", "15th Jan 21", "3rd Mar 22"
        m = re.match(r"^(\d{1,2})(?:st|nd|rd|th)?\s+(\w{3,9})\s+(\d{2,4})", s, re.I)
        if not m:
            return None
        day_str, month_str, year_str = m.group(1), m.group(2), m.group(3)
        months = "jan feb mar apr may jun jul aug sep oct nov dec"
        try:
            month_num = months.split().index(month_str.lower()[:3]) + 1
        except (ValueError, AttributeError):
            return None
        try:
            day = int(day_str)
            year = int(year_str)
            if year < 100:
                year += 2000 if year < 50 else 1900
            if day < 1 or day > 31 or month_num < 1 or month_num > 12:
                return None
            return f"{year:04d}-{month_num:02d}-{day:02d}"
        except (ValueError, TypeError):
            return None

    def _to_row(r):
        row = {}
        for col in TABLE_COLS:
            val = r.get(col)
            if val is None:
                row[col] = None
            elif col == "available_date" and isinstance(val, str) and val:
                row[col] = _parse_date_for_db(val)
            elif col in ("latitude", "longitude", "price", "deposit", "min_room_price_pcm", "max_room_price_pcm",
                        "room1_price_pcm", "room1_deposit", "room2_price_pcm", "room2_deposit",
                        "room3_price_pcm", "room3_deposit", "room4_price_pcm", "room4_deposit") and val is not None:
                try:
                    row[col] = float(val) if isinstance(val, (int, float)) else float(str(val).replace(",", ""))
                except (TypeError, ValueError):
                    row[col] = None
            elif col in ("photo_count", "room_count"):
                try:
                    row[col] = int(val) if val is not None else None
                except (TypeError, ValueError):
                    row[col] = None
            else:
                row[col] = str(val).strip() if val is not None else None
        return row
    rows = [_to_row(r) for r in results]
    landlord_ids_in_run = list({r.get("landlord_id") for r in results if r.get("landlord_id")})
    if landlord_ids_in_run:
        supabase.table("scraped_listings").delete().eq("tenant_id", tenant_id).in_("landlord_id", landlord_ids_in_run).execute()
    for i in range(0, len(rows), 100):
        supabase.table("scraped_listings").insert(rows[i : i + 100]).execute()
    print(f"\n✅ Successfully posted {len(rows)} listings to Supabase scraped_listings!")


# Call main() to scrape each individual listing
if __name__ == "__main__":
    main(listings)