import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { buildTenantAppUrl } from "@/lib/urls";
import { getFormWithQuestions } from "@/features/forms/data/forms";
import { FormBuilderPage } from "@/features/forms/ui/FormBuilderPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Client } from "@/features/clients/domain/types";

interface Props {
  params: { id: string };
}

export default async function FormBuilderRoute({ params }: Props) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");
  await requireFeature("forms");

  const [form, clientsResult] = await Promise.all([
    getFormWithQuestions(params.id),
    (async () => {
      try {
        const supabase = createSupabaseServerClient();
        const { data } = await supabase
          .from("clients")
          .select("id, full_name, email")
          .order("full_name");
        return (data ?? []) as Pick<Client, "id" | "full_name" | "email">[];
      } catch {
        return [];
      }
    })(),
  ]);

  if (!form) notFound();

  return (
    <FormBuilderPage
      form={form}
      clients={clientsResult}
      appUrl={buildTenantAppUrl(headers())}
    />
  );
}
