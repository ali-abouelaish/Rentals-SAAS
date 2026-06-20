import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { buildTenantAppUrl } from "@/lib/urls";
import { getForms } from "@/features/forms/data/forms";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FormsBuilderPage } from "@/features/forms/ui/FormsBuilderPage";
import type { Client } from "@/features/clients/domain/types";

export default async function FormsRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");
  await requireFeature("forms");

  const [forms, portfolios, clientsResult] = await Promise.all([
    getForms(),
    getPortfolios().catch(() => []),
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

  return (
    <FormsBuilderPage
      initialForms={forms}
      portfolios={portfolios}
      clients={clientsResult}
      appUrl={buildTenantAppUrl(headers())}
    />
  );
}
