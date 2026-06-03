import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { listContractTemplates } from "@/features/contracts/templates/data/templates";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { TemplatesListPage } from "@/features/contracts/templates/ui/TemplatesListPage";

export default async function ContractTemplatesRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");
  await requireFeature("contract_templates");

  const [templates, portfolios] = await Promise.all([
    listContractTemplates({ includeInactive: true }),
    getPortfolios(),
  ]);

  return <TemplatesListPage templates={templates} portfolios={portfolios} />;
}
