/**
 * The catalogue of listing fields a spreadsheet column can be mapped onto.
 *
 * Every entry targets a real `scraped_listings` column. There is deliberately
 * no landlord field: a spreadsheet belongs to the landlord it was attached to,
 * so `landlord_id` comes from the record, never from the sheet.
 *
 * `synonyms` drives auto-detection. They are matched case-insensitively against
 * the sheet's header text after punctuation is stripped, so "Rent (PCM)",
 * "rent_pcm" and "RENT PCM" all collapse to the same candidate. Order matters
 * within a field but not across fields — scoring resolves collisions.
 */

/**
 * `url` is distinct from `text` for a reason: Google Sheets' CSV export returns
 * a hyperlinked cell's *display text*, not its target — a cell linked to a Drive
 * folder but labelled "Pictures" arrives as the bare word "Pictures". Fields
 * typed `url` prefer the cell's real hyperlink when we can read one, and reject
 * non-URL text rather than storing it (stray text in a link column ends up as a
 * relative href in the UI).
 */
export type FieldType = "text" | "number" | "int" | "date" | "url";

/** Absolute http(s) URL — the only thing safe to render as a link. */
export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export type ListingField = {
  /** `scraped_listings` column, or `landlord_name` for the virtual lookup. */
  key: string;
  label: string;
  type: FieldType;
  /** Grouping for the mapping UI's dropdown. */
  group: "Core" | "Terms" | "Property" | "Preferences" | "Rooms" | "Media" | "Admin";
  synonyms: string[];
  /** Shown as the hint under the column's select on the mapping screen. */
  hint?: string;
  /**
   * Multiplier applied to the header-name score based on what the column
   * actually contains. Several photo-ish fields share synonyms ("photos"), and
   * the values are what tell them apart: a Drive *folder* link is not an image
   * URL. Return >1 to boost, <1 to suppress, 1 for no opinion.
   */
  valueBoost?: (samples: string[]) => number;
};

const DRIVE_LINK = /drive\.google\.com|docs\.google\.com\/.*folders/i;
const IMAGE_FILE = /\.(jpe?g|png|webp|gif|avif|heic)(\?|$)/i;

/** Fraction of non-empty samples matching `pattern`. */
function ratio(samples: string[], pattern: RegExp): number {
  const filled = samples.filter((s) => s && s.trim());
  if (filled.length === 0) return 0;
  return filled.filter((s) => pattern.test(s)).length / filled.length;
}

/** Prefers columns holding Drive links; rejects columns of direct image files. */
function preferDriveLinks(samples: string[]): number {
  if (ratio(samples, DRIVE_LINK) >= 0.5) return 1.6;
  if (ratio(samples, IMAGE_FILE) >= 0.5) return 0.2;
  return 1;
}

/** Prefers columns of direct image URLs; rejects Drive folder links. */
function preferImageUrls(samples: string[]): number {
  if (ratio(samples, IMAGE_FILE) >= 0.5) return 1.4;
  if (ratio(samples, DRIVE_LINK) >= 0.5) return 0.15;
  return 1;
}

export const LISTING_FIELDS: ListingField[] = [
  // ---------- Core ----------
  {
    key: "title",
    label: "Title",
    type: "text",
    group: "Core",
    synonyms: ["title", "listing", "listing name", "advert", "ad title", "headline", "name", "property name", "room name"],
    hint: "Headline shown in listing lists.",
  },
  {
    key: "url",
    label: "Listing URL",
    type: "url",
    group: "Core",
    synonyms: ["url", "link", "listing url", "listing link", "advert url", "ad link", "web link", "spareroom link", "source url", "permalink"],
    hint: "Used as the dedupe key when present.",
  },
  {
    key: "location",
    label: "Location / address",
    type: "text",
    group: "Core",
    synonyms: ["location", "address", "area", "postcode", "post code", "street", "property address", "full address", "town", "city", "district", "borough", "neighbourhood"],
    hint: "Free text — address, area or postcode.",
  },
  {
    key: "price",
    label: "Price (PCM)",
    type: "number",
    group: "Core",
    synonyms: ["price", "rent", "rent pcm", "pcm", "monthly rent", "rent per month", "price pcm", "monthly price", "asking rent", "rent amount", "cost", "rate"],
    hint: "Currency symbols, commas and 'pcm' are stripped automatically.",
  },
  {
    key: "status",
    label: "Status",
    type: "text",
    group: "Core",
    synonyms: ["status", "availability", "available", "let status", "state", "stage"],
    hint: "E.g. available, let, under offer.",
  },
  {
    key: "available_date",
    label: "Available from",
    type: "date",
    group: "Core",
    synonyms: ["available date", "available from", "avail from", "avail date", "availability date", "date available", "move in", "move in date", "start date", "available", "avail"],
    hint: "DD/MM/YYYY assumed for ambiguous dates.",
  },
  {
    key: "description",
    label: "Description",
    type: "text",
    group: "Core",
    synonyms: ["description", "details", "notes", "summary", "comments", "about", "remarks", "info"],
  },
  {
    key: "room_label",
    label: "Room name / number",
    type: "text",
    group: "Core",
    // Deliberately excludes "room type" — that describes what the room *is*
    // ("Double ensuite") and belongs to Property type. This field identifies
    // *which* room ("Room 2"), which is what Drive subfolders are named after.
    synonyms: ["room", "room name", "room no", "room number", "room ref", "bedroom", "unit", "unit name", "room id"],
    hint: "Matched against the Drive subfolder names to find this room's photos.",
  },
  // ---------- Terms ----------
  {
    key: "deposit",
    label: "Deposit",
    type: "number",
    group: "Terms",
    synonyms: ["deposit", "security deposit", "bond", "deposit amount", "holding deposit"],
  },
  {
    key: "min_term",
    label: "Minimum term",
    type: "text",
    group: "Terms",
    synonyms: ["min term", "minimum term", "min stay", "minimum stay", "min contract", "min tenancy"],
  },
  {
    key: "max_term",
    label: "Maximum term",
    type: "text",
    group: "Terms",
    synonyms: ["max term", "maximum term", "max stay", "maximum stay", "max contract", "max tenancy"],
  },
  {
    key: "bills_included",
    label: "Bills included",
    type: "text",
    group: "Terms",
    synonyms: ["bills", "bills included", "bills inc", "inclusive of bills", "utilities", "utilities included", "all bills"],
  },
  {
    key: "paying",
    label: "Pays commission",
    type: "text",
    group: "Terms",
    synonyms: ["paying", "pays", "pays commission", "commission", "commission payable", "fee payable", "paying landlord"],
  },

  // ---------- Property ----------
  {
    key: "property_type",
    label: "Property type",
    type: "text",
    group: "Property",
    synonyms: ["property type", "room type", "type", "prop type", "dwelling", "house type", "category", "accommodation type"],
  },
  {
    key: "furnishings",
    label: "Furnishings",
    type: "text",
    group: "Property",
    synonyms: ["furnishings", "furnished", "furnishing", "furniture"],
  },
  {
    key: "parking",
    label: "Parking",
    type: "text",
    group: "Property",
    synonyms: ["parking", "car park", "parking space", "off street parking"],
  },
  {
    key: "garden",
    label: "Garden",
    type: "text",
    group: "Property",
    synonyms: ["garden", "outdoor space", "yard", "patio", "balcony"],
  },
  {
    key: "broadband",
    label: "Broadband",
    type: "text",
    group: "Property",
    synonyms: ["broadband", "internet", "wifi", "wi fi", "fibre"],
  },
  {
    key: "total_rooms",
    label: "Total rooms",
    type: "text",
    group: "Property",
    synonyms: ["total rooms", "rooms", "no of rooms", "number of rooms", "bedrooms", "beds", "bed count"],
  },
  {
    key: "housemates",
    label: "Housemates",
    type: "text",
    group: "Property",
    synonyms: ["housemates", "flatmates", "sharers", "current housemates", "occupants", "tenants in situ"],
  },
  {
    key: "latitude",
    label: "Latitude",
    type: "number",
    group: "Property",
    synonyms: ["latitude", "lat"],
  },
  {
    key: "longitude",
    label: "Longitude",
    type: "number",
    group: "Property",
    synonyms: ["longitude", "long", "lng", "lon"],
  },

  // ---------- Preferences ----------
  { key: "smoker", label: "Smoker", type: "text", group: "Preferences", synonyms: ["smoker", "smokers"] },
  { key: "pets", label: "Pets", type: "text", group: "Preferences", synonyms: ["pets", "pet"] },
  { key: "occupation", label: "Occupation", type: "text", group: "Preferences", synonyms: ["occupation", "job", "profession"] },
  { key: "gender", label: "Gender", type: "text", group: "Preferences", synonyms: ["gender", "sex", "gender preference"] },
  { key: "couples_ok", label: "Couples OK", type: "text", group: "Preferences", synonyms: ["couples", "couples ok", "couples allowed", "couple friendly"] },
  { key: "smoking_ok", label: "Smoking OK", type: "text", group: "Preferences", synonyms: ["smoking ok", "smoking allowed", "smoking permitted"] },
  { key: "pets_ok", label: "Pets OK", type: "text", group: "Preferences", synonyms: ["pets ok", "pets allowed", "pet friendly", "pets permitted"] },
  { key: "pref_occupation", label: "Preferred occupation", type: "text", group: "Preferences", synonyms: ["preferred occupation", "pref occupation", "tenant type", "suitable for"] },
  { key: "references", label: "References", type: "text", group: "Preferences", synonyms: ["references", "reference", "referencing", "refs"] },
  { key: "min_age", label: "Minimum age", type: "text", group: "Preferences", synonyms: ["min age", "minimum age", "age from"] },
  { key: "max_age", label: "Maximum age", type: "text", group: "Preferences", synonyms: ["max age", "maximum age", "age to"] },

  // ---------- Rooms ----------
  {
    key: "room_count",
    label: "Rooms available",
    type: "int",
    group: "Rooms",
    synonyms: ["room count", "rooms available", "available rooms", "no of rooms available", "vacancies", "vacant rooms"],
  },
  {
    key: "min_room_price_pcm",
    label: "Cheapest room (PCM)",
    type: "number",
    group: "Rooms",
    synonyms: ["min room price", "cheapest room", "lowest price", "from price", "price from", "min price", "rent from"],
  },
  {
    key: "max_room_price_pcm",
    label: "Dearest room (PCM)",
    type: "number",
    group: "Rooms",
    synonyms: ["max room price", "most expensive room", "highest price", "to price", "price to", "max price", "rent to"],
  },
  { key: "room1_type", label: "Room 1 type", type: "text", group: "Rooms", synonyms: ["room 1 type", "room1 type"] },
  { key: "room1_price_pcm", label: "Room 1 price", type: "number", group: "Rooms", synonyms: ["room 1 price", "room1 price", "room 1 rent"] },
  { key: "room1_deposit", label: "Room 1 deposit", type: "number", group: "Rooms", synonyms: ["room 1 deposit", "room1 deposit"] },
  { key: "room2_type", label: "Room 2 type", type: "text", group: "Rooms", synonyms: ["room 2 type", "room2 type"] },
  { key: "room2_price_pcm", label: "Room 2 price", type: "number", group: "Rooms", synonyms: ["room 2 price", "room2 price", "room 2 rent"] },
  { key: "room2_deposit", label: "Room 2 deposit", type: "number", group: "Rooms", synonyms: ["room 2 deposit", "room2 deposit"] },
  { key: "room3_type", label: "Room 3 type", type: "text", group: "Rooms", synonyms: ["room 3 type", "room3 type"] },
  { key: "room3_price_pcm", label: "Room 3 price", type: "number", group: "Rooms", synonyms: ["room 3 price", "room3 price", "room 3 rent"] },
  { key: "room3_deposit", label: "Room 3 deposit", type: "number", group: "Rooms", synonyms: ["room 3 deposit", "room3 deposit"] },
  { key: "room4_type", label: "Room 4 type", type: "text", group: "Rooms", synonyms: ["room 4 type", "room4 type"] },
  { key: "room4_price_pcm", label: "Room 4 price", type: "number", group: "Rooms", synonyms: ["room 4 price", "room4 price", "room 4 rent"] },
  { key: "room4_deposit", label: "Room 4 deposit", type: "number", group: "Rooms", synonyms: ["room 4 deposit", "room4 deposit"] },

  // ---------- Media ----------
  {
    key: "drive_folder_url",
    label: "Google Drive photo folder",
    type: "url",
    group: "Media",
    synonyms: [
      "drive", "drive folder", "drive link", "google drive", "photos folder",
      "photo folder", "images folder", "pictures", "photos link", "media",
      "photo drive", "gallery link", "folder", "photos",
    ],
    hint: "Link to the property's Drive folder. We read its room subfolders and attach each room's photos.",
    valueBoost: preferDriveLinks,
  },
  {
    key: "first_photo_url",
    label: "Main photo URL",
    type: "url",
    group: "Media",
    synonyms: ["photo", "image", "main photo", "first photo", "photo url", "image url", "picture", "thumbnail", "cover photo"],
    valueBoost: preferImageUrls,
  },
  {
    key: "all_photos",
    label: "All photo URLs",
    type: "url",
    group: "Media",
    synonyms: ["all photos", "photos", "images", "gallery", "photo urls", "image urls"],
    valueBoost: preferImageUrls,
  },
  {
    key: "photo_count",
    label: "Photo count",
    type: "int",
    group: "Media",
    synonyms: ["photo count", "no of photos", "number of photos", "image count"],
  },

  // ---------- Admin ----------
  {
    key: "flag",
    label: "Flag",
    type: "text",
    group: "Admin",
    synonyms: ["flag", "tag", "label", "marker", "priority"],
  },
  {
    key: "external_ref",
    label: "Reference / ID",
    type: "text",
    group: "Admin",
    synonyms: ["ref", "reference", "id", "listing id", "property id", "code", "property code", "ref no", "reference number", "unique id"],
    hint: "Preferred dedupe key — a stable ID from the sheet keeps re-pulls from duplicating rows.",
  },
];

export const FIELD_BY_KEY: Record<string, ListingField> = Object.fromEntries(
  LISTING_FIELDS.map((f) => [f.key, f])
);

export const FIELD_GROUPS = ["Core", "Terms", "Property", "Preferences", "Rooms", "Media", "Admin"] as const;

/**
 * Field keys the importer handles itself rather than writing straight onto the
 * listing row. `external_ref` is stored, but only after the dedupe fallback
 * chain has run, so it is filtered out of the generic copy loop.
 */
export const VIRTUAL_FIELD_KEYS = new Set(["external_ref"]);

/**
 * Normalise a header (or synonym) for comparison: lowercase, punctuation and
 * separators to single spaces, trimmed. "Rent (PCM) £" → "rent pcm".
 */
export function normaliseHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[£$€%]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
