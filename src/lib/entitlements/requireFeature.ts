import { notFound } from "next/navigation";
import { getEntitlements } from "./getEntitlements";
import type { FeatureKey } from "./features";

export async function requireFeature(key: FeatureKey) {
  const enabled = await getEntitlements();
  if (!enabled.has(key)) {
    notFound();
  }
}

/**
 * Non-throwing entitlement check, for server actions.
 *
 * `requireFeature` calls `notFound()`, which is right for a page — the route
 * should not exist for a tenant without the feature. In a server action it is
 * wrong twice over: the action returns `{ error }` rather than throwing, and a
 * 404 thrown from a button click surfaces as a broken page instead of a message
 * explaining that the integration is not subscribed.
 */
export async function hasFeature(key: FeatureKey): Promise<boolean> {
  const enabled = await getEntitlements();
  return enabled.has(key);
}
