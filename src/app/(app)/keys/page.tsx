import { redirect } from "next/navigation";
import { Key as KeyIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getKeysOutForTenant } from "@/features/keys/data/queries";
import { KeysDashboardPage } from "@/features/keys/ui/KeysDashboardPage";

export default async function KeysRoute() {
  const profile = await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("keys")) {
    redirect("/dashboard?view=pm");
  }

  try {
    const items = await getKeysOutForTenant(profile.tenant_id);
    return <KeysDashboardPage items={items} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Keys</h1>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <KeyIcon className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Failed to load keys</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    );
  }
}
