import { Users2 } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPmTenants } from "@/features/pm-tenants/data/pm-tenants";
import { TenantsPage } from "@/features/pm-tenants/ui/TenantsPage";

export default async function TenantsRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  try {
    const tenants = await getPmTenants();
    return <TenantsPage initialTenants={tenants} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable = message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Tenants</h1>
        </div>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Users2 className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load tenants"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingTable
              ? "Apply the Phase 2 migrations in supabase/migrations/ to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}
