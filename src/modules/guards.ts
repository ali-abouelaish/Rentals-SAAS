import { redirect } from "next/navigation";
import { FeatureKey } from "@/lib/entitlements/features";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";

export async function requireModule(feature: FeatureKey) {
  const entitlements = await getEntitlements();

  if (!entitlements.has(feature)) {
    redirect("/upgrade");
  }
}
