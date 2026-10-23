"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { extractUkPostcode, geocodePostcode } from "@/lib/geo/postcodes";
import { manualListingSchema, type ManualListingValues } from "../domain/schemas";
import { manualListingToRow } from "../domain/manual-listing";

// Listings typed in by hand on the landlord page. They live in scraped_listings
// alongside the scraper's and the spreadsheet importer's rows, so they reach the
// public API, the maps and lead matching with no extra wiring, and are kept apart
// from both pipelines by `source`:
//   * every scraper sweep is scoped to source='spareroom'
//   * the sheet importer only ever upserts source='spreadsheet' refs
//   * external_ref is 'manual:<id>', so the (landlord_id, external_ref) unique
//     index can never match a scraped or imported row
// Only manual rows are editable here — a scraped or imported row would be
// overwritten or re-created by the next run.
//
// RLS server client throughout: scraped_listings policies are tenant-scoped, so
// a landlord or listing in another tenant reads as not found.

type Result = { ok: true; located: boolean } | { ok: false; error: string };

type Coordinates = { latitude: number | null; longitude: number | null };

/**
 * Map pin from the postcode in the location text. Never blocks a save: no
 * postcode, or postcodes.io failing, just leaves the listing unlocated. On edit,
 * an unchanged postcode keeps the coordinates it already has without a lookup.
 */
async function resolveCoordinates(
  location: string | null,
  existing?: { location: string | null; latitude: number | null; longitude: number | null }
): Promise<Coordinates> {
  const postcode = extractUkPostcode(location);
  if (!postcode) return { latitude: null, longitude: null };
  if (
    existing &&
    existing.latitude != null &&
    existing.longitude != null &&
    extractUkPostcode(existing.location) === postcode
  ) {
    return { latitude: existing.latitude, longitude: existing.longitude };
  }
  const found = await geocodePostcode(postcode);
  return found ?? { latitude: null, longitude: null };
}

function invalid(error: { issues: { message: string }[] }): Result {
  return { ok: false, error: error.issues[0]?.message ?? "Check the highlighted fields." };
}

function revalidateLandlord(landlordId: string | null) {
  if (landlordId) revalidatePath(`/landlords/${landlordId}`);
  // The landlords map plots every listing.
  revalidatePath("/landlords");
}

export async function createManualListing(
  landlordId: string,
  values: ManualListingValues
): Promise<Result> {
  const profile = await requireUserProfile();
  const parsed = manualListingSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createSupabaseServerClient();
  const { data: landlord, error: landlordError } = await supabase
    .from("landlords")
    .select("id")
    .eq("id", landlordId)
    .maybeSingle();
  if (landlordError) return { ok: false, error: landlordError.message };
  if (!landlord) return { ok: false, error: "Landlord not found." };

  const row = manualListingToRow(parsed.data);
  const coords = await resolveCoordinates(row.location);
  const id = randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("scraped_listings").insert({
    ...row,
    ...coords,
    id,
    tenant_id: profile.tenant_id,
    landlord_id: landlordId,
    source: "manual",
    external_ref: `manual:${id}`,
    // The scraper writes 'available' on every row; matching it keeps the
    // public API's status filter returning manual rows too.
    status: "available",
    // No trigger maintains these. last_seen_at also keeps the row sorting with
    // the others on the landlord page, which orders by it.
    last_seen_at: now,
    updated_at: now,
  });
  if (error) return { ok: false, error: error.message };

  revalidateLandlord(landlordId);
  return { ok: true, located: coords.latitude != null };
}

export async function updateManualListing(
  listingId: string,
  values: ManualListingValues
): Promise<Result> {
  await requireUserProfile();
  const parsed = manualListingSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("scraped_listings")
    .select("id, landlord_id, location, latitude, longitude")
    .eq("id", listingId)
    .eq("source", "manual")
    .maybeSingle();
  if (loadError) return { ok: false, error: loadError.message };
  if (!existing) {
    return { ok: false, error: "Listing not found, or it wasn't added by hand and can't be edited." };
  }

  const row = manualListingToRow(parsed.data);
  const coords = await resolveCoordinates(row.location, {
    location: existing.location ?? null,
    latitude: existing.latitude != null ? Number(existing.latitude) : null,
    longitude: existing.longitude != null ? Number(existing.longitude) : null,
  });
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("scraped_listings")
    .update({ ...row, ...coords, last_seen_at: now, updated_at: now })
    .eq("id", listingId)
    .eq("source", "manual");
  if (error) return { ok: false, error: error.message };

  revalidateLandlord(existing.landlord_id ?? null);
  return { ok: true, located: coords.latitude != null };
}

/** Admin-only, like deleting a landlord. Linked leads are unlinked (on delete set null). */
export async function deleteManualListing(
  listingId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("scraped_listings")
    .delete()
    .eq("id", listingId)
    .eq("source", "manual")
    .select("landlord_id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Listing not found, or it wasn't added by hand and can't be deleted here." };
  }

  revalidateLandlord(data[0].landlord_id ?? null);
  return { ok: true };
}
