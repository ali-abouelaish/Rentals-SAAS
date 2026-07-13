# Property Scraper API — Landlord Listings (SpareRoom)

One-page integration reference for the landlord property scraper that lives in the
rental-agency module. Covers the full round trip — **pull the landlord profiles to
scrape → scrape SpareRoom → write listings back → read them out** — plus a stable,
login-gated **deep link** that jumps a user straight to a landlord profile in the app.

---

## Overview

```
┌──────────────┐  1. GET profiles to scrape   ┌─────────────────────────────┐
│              │ ───────────────────────────▶ │ GET /api/landlords/          │
│   Scraper    │   Bearer SCRAPER_API_KEY      │     spareroom-profiles       │
│  (external   │ ◀─────────────────────────── │  (Harbor Ops app)            │
│   project)   │   profiles[] + flags          └─────────────────────────────┘
│              │
│              │  2. scrape each SpareRoom URL
│              │
│              │  3. write rows back            ┌─────────────────────────────┐
│              │ ───────────────────────────▶ │ Supabase table               │
│              │   service-role key             │   scraped_listings          │
└──────────────┘                                └─────────────────────────────┘
                                                        │
                                 4. app / partners read │  GET /api/public/
                                        listings back    ▼      scraped-listings

┌──────────────┐  5. click landlord deep link  ┌─────────────────────────────┐
│  Any surface │ ───────────────────────────▶ │ GET /go/landlord/<id>        │
│ (email, UI,  │   no key — login-gated        │  resolves user's tenant,     │
│  partner app)│ ◀─────────────────────────── │  302 → their subdomain page  │
└──────────────┘   302 /landlords/<id>          └─────────────────────────────┘
```

- **Base URL:** the Harbor Ops app origin (e.g. `https://{slug}.harborops.co.uk` or `APP_URL`).
- Data is **tenant-scoped**. Every request/row is tied to a `tenant_id` (uuid).
- Endpoints 1–4 are machine-to-machine (keys); endpoint 5 is a human browser link (auth session).

---

## 1. Get landlord profiles to scrape

Returns the SpareRoom profile URLs for a tenant's landlords, plus parallel flag arrays.

```
GET /api/landlords/spareroom-profiles?tenant_id=<uuid>
Authorization: Bearer <SCRAPER_API_KEY>
```

| Param | In | Required | Notes |
|---|---|---|---|
| `tenant_id` | query | yes | Tenant uuid to fetch landlords for |
| `Authorization` | header | yes | `Bearer <SCRAPER_API_KEY>` — shared secret in server env |

Only landlords with a non-null `spareroom_profile_url` are returned, ordered by name.

**200 response** — four parallel arrays (same index = same landlord):

```json
{
  "profiles":      ["https://www.spareroom.co.uk/...", "..."],
  "paying_flags":  ["yes", "no"],
  "profile_flags": ["", ""],
  "names":         ["Acme Lettings", "..."],
  "ids":           ["<landlord uuid>", "..."]
}
```

| Field | Meaning |
|---|---|
| `profiles[]` | SpareRoom profile URL to scrape |
| `paying_flags[]` | `"yes"`/`"no"` — whether the landlord pays commission |
| `profile_flags[]` | Always `""` (reserved; notes are not flags) |
| `names[]` | Landlord display name |
| `ids[]` | Landlord uuid — **store this as `landlord_id` on each scraped row** |

**Errors:** `401` bad/missing key · `400` missing `tenant_id` · `500` DB error.

---

## 2. Write scraped listings back

The scraper writes results **directly to the Supabase `scraped_listings` table** using
the service-role key (there is no ingest HTTP endpoint). Recommended pattern per run:

1. Delete existing rows for the landlords in this run:
   `delete from scraped_listings where tenant_id = <tenant_id> and landlord_id in (<ids in run>)`
2. Insert fresh rows in batches (≈100 per insert).

Required env for the write step:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only — never ship client-side) |

### `scraped_listings` columns

Every row **must** set `tenant_id` (uuid) and should set `landlord_id` (uuid, from step 1).

```
id                 uuid   (auto)          url                text
tenant_id          uuid   *required*      title              text
landlord_id        uuid   (FK landlords)  location           text
latitude           numeric               longitude           numeric
status             text                  price              numeric
description        text                  property_type      text
available_date     date                  min_term           text
max_term           text                  deposit            numeric
bills_included     text                  furnishings        text
parking            text                  garden             text
broadband          text                  housemates         text
total_rooms        text                  smoker             text
pets               text                  occupation         text
gender             text                  couples_ok         text
smoking_ok         text                  pets_ok            text
pref_occupation    text                  references         text
min_age            text                  max_age            text
photo_count        int                   first_photo_url    text
all_photos         text                  photos             text
paying             text   (yes/no)       flag               text
room_count         int                   min_room_price_pcm numeric
max_room_price_pcm numeric
room1_type text · room1_price_pcm numeric · room1_deposit numeric
room2_type text · room2_price_pcm numeric · room2_deposit numeric
room3_type text · room3_price_pcm numeric · room3_deposit numeric
room4_type text · room4_price_pcm numeric · room4_deposit numeric
created_at         timestamptz (auto)    updated_at         timestamptz (auto)
```

Notes:
- `references` is a reserved SQL word — quote it (`"references"`) in raw SQL.
- Most fields are loosely typed `text` to tolerate SpareRoom's free-form values;
  only prices/counts/coords are numeric.
- RLS scopes the table by `current_tenant_id()`; the service-role key bypasses RLS,
  so **always set `tenant_id` explicitly** on every inserted row.

---

## 3. Read listings back (public API)

Consumed by the app and trusted partner platforms. Uses a **per-tenant Public API key**
(issued in-app at *Settings → API Keys*), not the scraper key.

```
GET /api/public/scraped-listings
Authorization: Bearer <public_api_key>      # or:  x-api-key: <public_api_key>
```

Requires the key to hold the `scraped_listings:read` scope. Tenant is derived from the key.

**Query params** (all optional):

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | 50 | clamped 1–200 |
| `offset` | int | 0 | pagination offset |
| `sort` | `col.dir` | `created_at.desc` | col ∈ `created_at, updated_at, price, available_date, min_room_price_pcm, max_room_price_pcm`; dir `asc`/`desc` |
| `status` | string | — | exact match |
| `landlord_id` | uuid | — | exact match |
| `property_type` | string | — | exact match |
| `paying` | string | — | exact match (`yes`/`no`) |
| `min_price` / `max_price` | number | — | on `price` |
| `location` | string | — | case-insensitive contains |
| `available_from` | `YYYY-MM-DD` | — | `available_date >=` |

**200 response:**

```json
{
  "data": [ { /* scraped_listings row + "landlord_name": "Acme Lettings" */ } ],
  "pagination": { "limit": 50, "offset": 0, "total": 123, "has_more": true },
  "landlord_count": 17
}
```

Each row is a full `scraped_listings` row plus a flattened **`landlord_name`**
(text, or `null` if the listing has no linked landlord) resolved from `landlord_id`.

**Errors:** `401` missing/invalid key · `403` key lacks `scraped_listings:read` scope · `500` DB error.

---

## 4. Deep link to a landlord profile (redirect)

A stable, login-gated link that takes a user straight to a landlord's profile in
Harbor Ops. Use it anywhere you hold a `landlord_id` (uuid) — the same id returned
by step 1 and stored on each scraped row.

```
https://harborops.co.uk/go/landlord/<landlord_id>
```

- **No tenant subdomain needed in the link.** The tenant is resolved from the
  *signed-in user*, not the landlord. The link is the same regardless of tenant.
- **Signed in** → 302 to `https://{user-slug}.harborops.co.uk/landlords/<id>`.
- **Signed out** → sent to login, then returned to the landlord profile after
  signing in (the destination is preserved).
- Data on the destination page is tenant-scoped (RLS): a user only ever sees
  landlords in their own agency. A link to a landlord outside their tenant loads
  no data.
- No API key required — it's a human-facing browser link, safe to embed in
  emails, dashboards, or partner UIs.

---

## Environment summary

| Var | Used by | Purpose |
|---|---|---|
| `SCRAPER_API_KEY` | step 1 | Bearer secret to pull landlord profiles |
| `APP_URL` | steps 1 & 3 | Harbor Ops app base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | step 2 | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | step 2 | Write listings back (server-only) |
| Public API key | step 3 | Read listings; issued per tenant in-app, needs `scraped_listings:read` scope |
| `APP_PORTAL_DOMAIN` | step 5 | Portal domain (e.g. `harborops.co.uk`); used to build the deep-link subdomain hand-off. No key needed for the link itself. |
