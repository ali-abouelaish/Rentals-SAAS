import { FeatureKey } from "./features";

/**
 * Replace this with real DB call later.
 * For now this simulates what the organisation has licensed.
 */
export async function getEntitlements(): Promise<Set<FeatureKey>> {
  return new Set<FeatureKey>([
    "agents",
    "clients",
    "rentals",
    "landlords",
    "earnings",
    "invoices",
    // remove or add features per client
  ]);
}
