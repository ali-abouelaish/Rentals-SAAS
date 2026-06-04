import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import {
  getConnection,
  listProtections,
  listReleaseRequests,
} from "@/features/mydeposits/data/protections";
import { DepositsPage } from "@/features/mydeposits/ui/DepositsPage";

export default async function DepositsRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("mydeposits")) {
    redirect("/dashboard?view=pm");
  }

  try {
    const [connection, protections, releaseRequests] = await Promise.all([
      getConnection(),
      listProtections(),
      listReleaseRequests(),
    ]);
    return (
      <DepositsPage
        connection={connection}
        protections={protections}
        releaseRequests={releaseRequests}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable = message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Deposit Protection</h1>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <ShieldCheck className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load deposit protection"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingTable
              ? "Apply the latest migrations in supabase/migrations/ to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}
