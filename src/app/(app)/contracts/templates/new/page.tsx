import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { UploadTemplateForm } from "@/features/contracts/templates/ui/UploadTemplateForm";

export default async function NewContractTemplateRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");
  await requireFeature("contract_templates");

  const portfolios = await getPortfolios();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/contracts/templates"
          className="inline-flex items-center gap-1 text-sm text-foreground-secondary hover:text-foreground"
        >
          <ChevronLeft size={16} /> Back to templates
        </Link>
        <h1 className="text-2xl font-bold text-foreground tracking-tight mt-2">New Contract Template</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Upload your tenancy contract PDF. You&apos;ll mark dynamic fields visually on the next step.
        </p>
      </div>
      <UploadTemplateForm portfolios={portfolios} />
    </div>
  );
}
