import { notFound, redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getCloseForMonth, getCloseInfoForMonth } from "@/features/finances/data/closes";
import { MonthlySummaryReport } from "@/features/finances/ui/MonthlySummaryReport";

export default async function MonthlySummaryRoute({
  params,
}: {
  params: { year: string; month: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("finances")) {
    redirect("/dashboard?view=pm");
  }

  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    notFound();
  }

  try {
    const [close, info] = await Promise.all([
      getCloseForMonth(year, month),
      getCloseInfoForMonth(year, month),
    ]);
    if (!close) {
      return (
        <div className="space-y-5">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Monthly Summary</h1>
          <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
              <ClipboardCheck className="h-7 w-7 text-brand" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-2">No close on file</p>
            <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
              This month has not been closed yet.
            </p>
          </div>
        </div>
      );
    }
    return <MonthlySummaryReport close={close} closedByName={info.closed_by_name} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable =
      message.includes("schema cache") || message.includes("does not exist");
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Monthly Summary</h1>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <ClipboardCheck className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load summary"}
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
