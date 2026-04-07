import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { NewEvaluationFlow } from "@/features/acquisition-insights/ui/NewEvaluationFlow";

export default async function NewEvaluationPage() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const portfolios = await getPortfolios().catch(() => []);

  return <NewEvaluationFlow portfolios={portfolios} />;
}
