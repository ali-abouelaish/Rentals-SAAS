import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getConnection } from "@/features/mydeposits/data/protections";
import { MydepositsConnectionCard } from "@/features/mydeposits/ui/MydepositsConnectionCard";

export default async function DepositsSettingsPage() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("mydeposits")) {
    redirect("/dashboard?view=pm");
  }

  const connection = await getConnection().catch(() => null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Deposit Protection</h1>
        <p className="text-xs text-foreground-secondary">
          Connect your mydeposits (Total Property) account.
        </p>
      </div>
      {/* useSearchParams (for ?connected/?error toasts) requires a Suspense boundary. */}
      <Suspense>
        <MydepositsConnectionCard connection={connection} />
      </Suspense>
    </div>
  );
}
