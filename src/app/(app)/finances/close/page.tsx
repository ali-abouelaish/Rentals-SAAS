import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getFinanceRollup } from "@/features/finances/data/queries";
import { getCloseForMonth } from "@/features/finances/data/closes";
import { CloseChecklist } from "@/features/finances/ui/CloseChecklist";

function parseMonth(value: string | undefined): { year: number; month: number } {
  // Default to *previous* month for the close UI since you cannot close the
  // current month.
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const fallback = { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
  if (!value) return fallback;
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (!match) return fallback;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return fallback;
  }
  return { year, month };
}

export default async function FinancesCloseRoute({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  if (!entitlements.has("finances")) {
    redirect("/dashboard?view=pm");
  }

  const profile = await requireUserProfile();
  const role = (profile.role ?? "").toLowerCase();
  const canReopen = role === "super_admin";

  const { year, month } = parseMonth(searchParams.month);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const now = new Date();
  const currentY = now.getUTCFullYear();
  const currentM = now.getUTCMonth() + 1;
  const isFutureOrCurrent =
    year > currentY || (year === currentY && month >= currentM);

  try {
    const [rollup, close] = await Promise.all([
      getFinanceRollup(year, month),
      getCloseForMonth(year, month),
    ]);
    return (
      <CloseChecklist
        year={year}
        month={month}
        monthLabel={rollup.month_label}
        monthKey={monthKey}
        rollup={rollup}
        close={close}
        isFutureOrCurrent={isFutureOrCurrent}
        canReopen={canReopen}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable =
      message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Monthly Close</h1>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <ClipboardCheck className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load close workflow"}
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
