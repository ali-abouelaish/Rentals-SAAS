// SpaceStone service: reference-data lookups. Returned raw (passthrough) — the
// UI only needs id/name pairs and these payloads are small and stable.

import { mdFetch, type MdContext } from "./apiClient";
import { MD_API_VERSION, MD_SERVICE } from "./config";

const SPS = `${MD_SERVICE.spaceStone}/${MD_API_VERSION}`;

async function lookup(ctx: MdContext, resource: string): Promise<unknown[]> {
  const raw = await mdFetch<unknown>(ctx, `${SPS}/${resource}`);
  return Array.isArray(raw) ? raw : [];
}

export const getSettlementTypes = (ctx: MdContext) => lookup(ctx, "settlement-types");
export const getReleaseRequestStatuses = (ctx: MdContext) => lookup(ctx, "release-request-statuses");
export const getRentFrequencies = (ctx: MdContext) => lookup(ctx, "rent-frequencies");
export const getCountries = (ctx: MdContext) => lookup(ctx, "countries");
