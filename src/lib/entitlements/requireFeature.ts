import { notFound } from "next/navigation";
import { getEntitlements } from "./getEntitlements";
import type { FeatureKey } from "./features";

export async function requireFeature(key: FeatureKey) {
  const enabled = await getEntitlements();
  if (!enabled.has(key)) {
    notFound();
  }
}
