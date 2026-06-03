import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getContractTemplate } from "@/features/contracts/templates/data/templates";
import { listBookingFormQuestionsForTemplate } from "@/features/contracts/templates/data/lookups";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { TemplateEditor } from "@/features/contracts/templates/ui/TemplateEditor";

export default async function ContractTemplateEditorRoute({
  params,
}: {
  params: { id: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");
  await requireFeature("contract_templates");

  const [template, questions, portfolios] = await Promise.all([
    getContractTemplate(params.id),
    listBookingFormQuestionsForTemplate(params.id).catch(() => []),
    getPortfolios(),
  ]);
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/contracts/templates"
          className="inline-flex items-center gap-1 text-sm text-foreground-secondary hover:text-foreground"
        >
          <ChevronLeft size={16} /> Back to templates
        </Link>
      </div>
      <TemplateEditor template={template} questions={questions} portfolios={portfolios} />
    </div>
  );
}
