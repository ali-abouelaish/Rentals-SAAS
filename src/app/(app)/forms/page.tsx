import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getForms } from "@/features/forms/data/forms";
import { FormsListPage } from "@/features/forms/ui/FormsListPage";

export default async function FormsRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");
  await requireFeature("forms");

  const forms = await getForms();

  return <FormsListPage initialForms={forms} />;
}
