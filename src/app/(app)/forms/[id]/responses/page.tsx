import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getFormWithQuestions, getFormSubmissions } from "@/features/forms/data/forms";
import { FormResponsesPage } from "@/features/forms/ui/FormResponsesPage";

interface Props {
  params: { id: string };
}

export default async function FormResponsesRoute({ params }: Props) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");
  await requireFeature("forms");

  const [form, submissions] = await Promise.all([
    getFormWithQuestions(params.id),
    getFormSubmissions(params.id),
  ]);

  if (!form) notFound();

  return <FormResponsesPage form={form} initialSubmissions={submissions} />;
}
