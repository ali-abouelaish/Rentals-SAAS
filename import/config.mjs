// Central config for the AP Real Estate / Horizon Dreams portfolio import.
// Every mapping that may need adjusting after AP edits the sheet lives here.

export const SOURCE_FILE = "import/source/PORTFOLIO AVAILIABILITY.xlsx"; // filename misspelling is real
export const OUT_DIR = "import/out";
export const CONTRACTS_DIR = "import/contracts";

// Live agency tenant in Harbor Ops. The prior portfolio import migrations
// (20260430000002/3) seeded both portfolios under this tenant.
export const DEFAULT_TENANT_ID = "b5b00020-9b30-4288-8ab4-a1e6c900dc96";

// Portfolio (company) names as they exist in public.portfolios.
export const PORTFOLIOS = {
  AP: { name: "AP", sheetBanner: "AP REAL ESTATE", color: "#0d9488" },
  HORIZON: { name: "Horizon Dreams", sheetBanner: "HORIZON DREAMS", color: "#2563eb" },
};

// ---------------------------------------------------------------------------
// Property Portfolio tab
// ---------------------------------------------------------------------------

// Column positions (0-based). AP section has no header row; Horizon does.
export const AP_COLUMNS = {
  rowNum: 0, available: 1, property: 2, room: 3, area: 4,
  postcode: 5, beds: 6, baths: 7, pcm: 8,
};
export const HORIZON_COLUMNS = {
  ...AP_COLUMNS,
  tenantName: 9, phone: 10, dob: 11, email: 12, nationality: 13, contract: 14,
};

// Canonical area per misspelling/drift. Keys are lowercased trimmed raw values.
export const AREA_MAP = {
  lampeth: "Lambeth",
  "surrey ways": "Surrey Quays",
};

// One canonical area per property (enforced; every remap is reported).
// Keys are canonical property names.
export const PROPERTY_AREA = {
  "Netherby House": "Lambeth", // sheet shows Lambeth / Lampeth / Battersea
  "Plough Way": "Canada Water", // sheet shows Canada Water / Surrey Quays
};

// Canonical property name per raw spelling (trimmed). Display names; the
// legal address line comes from the Contract column head address.
export const PROPERTY_NAME_MAP = {
  "everard house": "Everard House", // trailing-space variant points at a different Drive folder
};

// One canonical postcode per property where rows conflict.
export const PROPERTY_POSTCODE = {
  "Boundaries Road": "SW12 8EU", // head address in Contract column says SW12 8EU; rows also show SW12 8HD
};

// Head addresses (legal address line) confirmed from the Contract column.
// Used when the Contract cell is missing for some rows of the property.
export const PROPERTY_HEAD_ADDRESS = {
  "Court Street 1": "1A Court Street, E1 1DG",
  "Court Street 2": "1A Court Street, E1 1DG",
};

// Sheet display name -> existing Harbor Ops property name, for the cases where
// fuzzy matching cannot bridge the difference. Verified against live data:
// row 46's Contract cell labels Court Street 2 as "Flat 2".
export const PROPERTY_DB_ALIASES = {
  "Court Street 1": "1A Court Street (Flat 1)",
  "Court Street 2": "1A Court Street (Flat 2)",
  "Chargrove Pl": "7 Chargrove Close",
  "Trundley Road": "149 Trundley's Road",
};

// Explicit email fixes (auditable identity changes; everything else is flag-only).
export const EMAIL_FIX_MAP = {
  "sofia.alekseemko16@gmail.con": "sofia.alekseemko16@gmail.com",
};

// Near-miss domains/endings that get flagged (not auto-fixed unless in EMAIL_FIX_MAP).
export const SUSPECT_EMAIL_DOMAIN_RE = /(\.(con|cmo|coml|vom)$|@(gmial|gamil|gnail|hotmial|hotmal|yaho|outlok)\.)/i;

// Dual rent cells like "£1,120 / £1,160": first value is the contractual rent
// (and deposit), the pair becomes the unit min/max range; row is flagged.
export const DUAL_RENT_RULE = "first";

// Availability status -> Harbor Ops units.status.
// relet = a BOOKED suffix was present; marketed = an "(Available)" suffix was
// present (ends on date AND being marketed). A plain end date stays "occupied"
// — that matches the prior import's convention (end dates live in available_date).
export function unitStatusFor({ status, relet, marketed }) {
  if (status === "NOW") return relet ? "booked" : "available";
  if (status === "BOOKED") return "booked";
  if (status === "ROLLING") return "occupied";
  if (status === "TBC") return "on_hold";
  if (status === "RENEW") return "renewal";
  if (status === "DATE") return relet ? "replacement" : marketed ? "move_out" : "occupied";
  return "on_hold";
}

// ---------------------------------------------------------------------------
// Keybox Codes tab
// ---------------------------------------------------------------------------

export const KEYBOX_COLUMNS = { rowNum: 0, address: 1, code: 2, company: 3 };

// Keybox address -> canonical property name (fuzzy match handles the rest).
// "37 Balman House" is absent from the Property Portfolio tab but exists in
// Harbor Ops as "37 Balman" — the diff stage falls back to system properties.
export const KEYBOX_ADDRESS_MAP = {
  "25 john silkin": "John Silikin Lane", // sheet typo: silkin vs Silikin
  "48 ann moss": "Ann Moss Way",
};

// Keys-table conventions from the prior import (20260430000001..3):
export const KEY_ROW = { set_name: "Keybox", copy_label: "Code", status: "in_office" };
export const NO_KEYBOX_VALUES = new Set(["NO", "N0", "NONE"]);

// ---------------------------------------------------------------------------
// Image remap (import/remap-images.mjs)
// ---------------------------------------------------------------------------

// Drive folder id -> DB property name override. Sheet row 21 was repurposed by
// staff (old Broxbourne-A row renamed "Everard House" but keeping Bow/E3 3LJ),
// which created a chimera property on 12 Jun 2026; its folder's photos belong
// to the real Everard House.
export const FOLDER_PROPERTY_OVERRIDES = {
  "10gw4Ha4Iqpq2jrmXXe713VEXur3gkS1m": "15 Everard House",
};

// Subfolder names that are communal spaces, mapped onto the unit_photos
// category enum (room|bathroom|kitchen|exterior|garden|communal|wc).
export const COMMUNAL_SUBFOLDER_CATEGORIES = {
  kitchen: "kitchen", "kitchen 2": "kitchen", "kitchen 3": "kitchen",
  bathroom: "bathroom", bath: "bathroom", shower: "bathroom",
  wc: "wc", toilet: "wc",
  garden: "garden",
  exterior: "exterior", outside: "exterior", front: "exterior", building: "exterior",
  "common areas": "communal", "common area": "communal", common: "communal",
  communal: "communal", "living room": "communal", living: "communal",
  lounge: "communal", hallway: "communal", hall: "communal",
  reception: "communal", dining: "communal", corridor: "communal",
};

// ---------------------------------------------------------------------------
// Tenant field rules
// ---------------------------------------------------------------------------

// pm_tenants.full_name/email/phone are NOT NULL; the prior import used the
// literal 'unknown' for missing contact fields. Keep that convention.
export const UNKNOWN_CONTACT = "unknown";

export const DOB_MIN_AGE = 16;
export const DOB_MAX_AGE = 100;

// Phone country codes we accept for non-UK numbers (code -> expected total digits range).
export const FOREIGN_DIAL_CODES = [
  { code: "33", min: 11, max: 11 },  // France
  { code: "353", min: 11, max: 12 }, // Ireland
  { code: "90", min: 12, max: 12 },  // Turkey
  { code: "91", min: 12, max: 12 },  // India
  { code: "92", min: 12, max: 12 },  // Pakistan
  { code: "86", min: 13, max: 13 },  // China
  { code: "52", min: 12, max: 13 },  // Mexico
  { code: "00", min: 0, max: 0 },    // placeholder, never matches
];

// ---------------------------------------------------------------------------
// Contract PDF start-date extraction
// ---------------------------------------------------------------------------

export const START_DATE_KEYWORDS = [
  "commencing", "commencement", "start date", "starting", "begins",
  "term", "from", "move in", "move-in",
];
// How close (in characters) a date must sit to a keyword to count as confident.
export const KEYWORD_WINDOW = 220;

// ---------------------------------------------------------------------------
// Deposit rule (decision already made): one month's rent, equal to PCM.
// ---------------------------------------------------------------------------
export const depositFor = (rentPcm) => rentPcm;
