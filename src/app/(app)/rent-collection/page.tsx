import { redirect } from "next/navigation";
import { Banknote } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getRentCollectionRows } from "@/features/rent-collection/data/queries";
import { RentCollectionPage } from "@/features/rent-collection/ui/RentCollectionPage";

export default async function RentCollectionRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("rent_collection")) {
    redirect("/dashboard?view=pm");
  }

  try {
    const rows = await getRentCollectionRows();
    return <RentCollectionPage rows={rows} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable = message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Rent Collection</h1>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Banknote className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load rent collection"}
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
