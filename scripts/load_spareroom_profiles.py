"""
Load SpareRoom profile URLs from the SAAS app (landlord profiles) instead of Google Sheet.
Set in env: APP_URL, SCRAPER_API_KEY, TENANT_ID.
Returns: (profiles, paying_flags, property_flags) same shape as the old Google Sheet load.
"""
import os
import sys

try:
    import requests
except ImportError:
    print("Install requests: pip install requests", file=sys.stderr)
    sys.exit(1)


def load_profiles_from_app():
    app_url = os.environ.get("APP_URL") or os.environ.get("NEXT_PUBLIC_APP_URL")
    api_key = os.environ.get("SCRAPER_API_KEY")
    tenant_id = os.environ.get("TENANT_ID")

    if not app_url or not api_key or not tenant_id:
        print(
            "Set APP_URL (or NEXT_PUBLIC_APP_URL), SCRAPER_API_KEY and TENANT_ID to load from the app.",
            file=sys.stderr,
        )
        return None, None, None

    base = app_url.rstrip("/")
    url = f"{base}/api/landlords/spareroom-profiles?tenant_id={tenant_id}"
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"Failed to load profiles from app: {e}", file=sys.stderr)
        return None, None, None

    profiles = data.get("profiles") or []
    paying_flags = data.get("paying_flags") or [""] * len(profiles)
    profile_flags = data.get("profile_flags") or [""] * len(profiles)

    # Align lengths
    while len(paying_flags) < len(profiles):
        paying_flags.append("")
    while len(profile_flags) < len(profiles):
        profile_flags.append("")
    paying_flags = paying_flags[: len(profiles)]
    property_flags = profile_flags[: len(profiles)]

    return profiles, paying_flags, property_flags


if __name__ == "__main__":
    profiles, paying, prop = load_profiles_from_app()
    if profiles is None:
        sys.exit(1)
    print(f"Loaded {len(profiles)} landlord SpareRoom profiles from the app.")
    for i, u in enumerate(profiles):
        print(f"  {i + 1}. {u} (paying={paying[i]}, flag={prop[i] or '-'})")
