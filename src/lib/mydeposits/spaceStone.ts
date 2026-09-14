// Reference-data lookups.
//
// ⚠ Despite this file's name, the lookups are NOT all on SpaceStone. Verified
// live against sandbox (2026-08-21) — they are split across three services and
// two different path spellings (`lookups` vs `look-up`):
//
//   /sps/api/v1/lookups/countries                  200
//   /sps/api/v1/lookups/countries/{id}/regions     (per docs)
//   /sps/api/v1/lookups/addresses?postcode=        200
//   /sps/api/v1/lookups/offices                    200
//   /rs/api/v1/look-up/rent-frequencies            200
//   /rs/api/v1/look-up/property-types              200
//   /rs/api/v1/look-up/landlord-companies          200
//   /ts/api/v1/lookups/settlement-types            200
//   /ts/api/v1/lookups/release-request-statuses    200
//
// The previous single-prefix assumption (`/sps/v1/<name>`) 404'd on every call.

import { mdFetch, type MdContext } from "./apiClient";
import { MD_API_VERSION, MD_SERVICE } from "./config";

const SPS = `${MD_SERVICE.spaceStone}/${MD_API_VERSION}/lookups`;
const RS = `${MD_SERVICE.realityStone}/${MD_API_VERSION}/look-up`;
const TS = `${MD_SERVICE.timeStone}/${MD_API_VERSION}/lookups`;

/** Lookup rows are uniformly `{ id, text }`; `text` is an i18n key for enum-ish sets. */
export type MdLookup = { id: number; text: string };

async function lookup(ctx: MdContext, path: string): Promise<MdLookup[]> {
  const raw = await mdFetch<unknown>(ctx, path);
  return Array.isArray(raw) ? (raw as MdLookup[]) : [];
}

export const getCountries = (ctx: MdContext) => lookup(ctx, `${SPS}/countries`);
export const getRegions = (ctx: MdContext, countryId: number | string) =>
  lookup(ctx, `${SPS}/countries/${encodeURIComponent(String(countryId))}/regions`);
export const getRentFrequencies = (ctx: MdContext) => lookup(ctx, `${RS}/rent-frequencies`);
export const getPropertyTypes = (ctx: MdContext) => lookup(ctx, `${RS}/property-types`);
export const getLandlordCompanies = (ctx: MdContext) => lookup(ctx, `${RS}/landlord-companies`);
export const getSettlementTypes = (ctx: MdContext) => lookup(ctx, `${TS}/settlement-types`);
export const getReleaseRequestStatuses = (ctx: MdContext) =>
  lookup(ctx, `${TS}/release-request-statuses`);

/** Full office records (not `{id,text}`) — the agency's offices, with addresses. */
export type MdOffice = {
  id: number;
  text: string;
  address?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: { id: number; iso: string; text: string } | null;
    region?: { id: number; text: string } | null;
    isAddressSetManually?: boolean;
  } | null;
};

export async function getOffices(ctx: MdContext): Promise<MdOffice[]> {
  const raw = await mdFetch<unknown>(ctx, `${SPS}/offices`);
  return Array.isArray(raw) ? (raw as MdOffice[]) : [];
}

/**
 * The agency's default office id — required by every property-creation call.
 * Falls back to the first office; agencies in sandbox have exactly one
 * ("Head office").
 */
export async function resolveDefaultOfficeId(ctx: MdContext): Promise<number> {
  const offices = await getOffices(ctx);
  const id = offices[0]?.id;
  if (!id) throw new Error("mydeposits returned no offices for this agency.");
  return id;
}

/** Address autocomplete for a postcode (returns [] when nothing matches). */
export const getAddresses = (ctx: MdContext, postcode: string) =>
  mdFetch<unknown>(ctx, `${SPS}/addresses?postcode=${encodeURIComponent(postcode)}`).then((r) =>
    Array.isArray(r) ? r : []
  );
