import type { ListingMapPoint } from "./types";

/** The scraped_listings columns a map pin is built from. */
export const MAP_POINT_COLUMNS =
  "id, landlord_id, title, location, price, min_room_price_pcm, room_count, url, last_seen_at, latitude, longitude";

type ScrapedListingRow = {
  id: string;
  landlord_id?: string | null;
  title?: string | null;
  location?: string | null;
  price?: number | string | null;
  min_room_price_pcm?: number | string | null;
  room_count?: number | string | null;
  url?: string | null;
  last_seen_at?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Turns a scraped_listings row into a map pin, or null when it has nowhere to
 * go. Callers count the nulls: a listing missing from the map has to be visible
 * as missing, not silently absent.
 */
export function toListingMapPoint(
  row: ScrapedListingRow,
  landlord: { name: string | null } | null
): ListingMapPoint | null {
  const lat = toNumber(row.latitude);
  const lng = toNumber(row.longitude);
  if (lat === null || lng === null) return null;
  // (0, 0) is what a failed coordinate parse looks like, not a listing in the
  // Gulf of Guinea — plotting it would drag fitBounds out to the whole globe.
  if ((lat === 0 && lng === 0) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const roomCount = toNumber(row.room_count);
  const minRoomPrice = toNumber(row.min_room_price_pcm);
  const fromPrice = roomCount !== null && roomCount > 1 && minRoomPrice !== null;

  return {
    id: row.id,
    landlordId: row.landlord_id ?? null,
    landlordName: landlord?.name ?? null,
    title: row.title ?? null,
    location: row.location ?? null,
    priceGbp: fromPrice ? minRoomPrice : toNumber(row.price),
    fromPrice,
    roomCount,
    // Same guard as the detail page's listings table: a relative or junk URL
    // (stray spreadsheet text) must never become a link.
    url: /^https?:\/\//i.test(row.url ?? "") ? (row.url as string) : null,
    lastSeenAt: row.last_seen_at ?? null,
    lat,
    lng,
  };
}
