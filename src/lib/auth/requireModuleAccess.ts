import { redirect } from "next/navigation";
import { requireUserProfile } from "./requireRole";
import { getPublishedModuleConfigForApp } from "@/features/admin/data/admin";

/**
 * Validates that the current tenant has access to the requested module.
 * Redirects to /dashboard with a 403 message if access is denied.
 *
 * Call at the top of server component pages for module-gated routes.
 */
export async function requireModuleAccess(
  module: "rental_agency" | "property_management"
) {
  const profile = await requireUserProfile();
  const config = await getPublishedModuleConfigForApp(profile.tenant_id);

  const hasAccess =
    module === "rental_agency"
      ? config.rental_agency_enabled
      : config.property_management_enabled;

  if (!hasAccess) {
    // Redirect to whichever dashboard the tenant does have access to
    const fallbackView = config.property_management_enabled ? "?view=pm" : "";
    redirect(`/dashboard${fallbackView}`);
  }

  return profile;
}
