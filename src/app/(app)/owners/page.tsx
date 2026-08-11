import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { formatDate, formatPence } from "@/lib/utils/formatters";
import { listOwners } from "@/features/owners/data/owners";
import { formatFeeConfig } from "@/features/owners/domain/types";
import { CreateOwnerDialog } from "@/features/owners/ui/OwnerActions";
import { monthLabel } from "@/features/owner-statements/domain/derive";

export default async function OwnersRoute({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  await requireFeature("owner_statements");

  const query = searchParams?.q ?? "";

  let owners;
  try {
    owners = await listOwners(query);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingColumn =
      message.includes("schema cache") || message.includes("does not exist");
    return (
      <div className="space-y-5">
        <PageHeader title="Landlords" subtitle="Property owners and their statements" />
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Building2 className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingColumn ? "Database migrations pending" : "Failed to load landlords"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingColumn
              ? "Apply the latest migrations in supabase/migrations/ to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--gap-bento)]">
      <PageHeader
        title="Landlords"
        subtitle="The owners of the properties you manage — and their statements"
        action={<CreateOwnerDialog />}
      />

      {/* Plain GET form: search is server-side so results survive a reload. */}
      <form className="flex items-center gap-2" action="/owners">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <label htmlFor="q" className="sr-only">
            Search landlords
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Search by name, email or phone"
            className="h-9 w-full rounded-lg border border-border bg-surface-inset pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
      </form>

      {owners.length === 0 ? (
        <div className="rounded-bento bg-surface-card shadow-bento py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Building2 className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {query ? "No landlords match that search" : "No landlords yet"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {query
              ? "Try a different name, email or phone number."
              : "Add the owners of the properties you manage, then generate their monthly statements here."}
          </p>
        </div>
      ) : (
        <div className="rounded-bento bg-surface-card shadow-bento p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-foreground-muted">
                <th className="pb-2 pr-3 font-medium">Landlord</th>
                <th className="pb-2 pr-3 font-medium">Contact</th>
                <th className="pb-2 pr-3 font-medium text-right">Properties</th>
                <th className="pb-2 pr-3 font-medium">Fee</th>
                <th className="pb-2 pr-3 font-medium">Last statement</th>
                <th className="pb-2 pr-3 font-medium text-right">Closing balance</th>
                <th className="pb-2 font-medium">Contract expiry</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.id} className="border-t border-border/60">
                  <td className="py-2.5 pr-3">
                    <Link href={`/owners/${o.id}`} className="font-medium text-brand hover:underline">
                      {o.name}
                    </Link>
                    {o.unsent_count > 0 && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        title={`${o.unsent_count} statement${o.unsent_count === 1 ? "" : "s"} generated but not yet sent`}
                      >
                        {o.unsent_count} unsent
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary">
                    {o.email ?? o.phone ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-foreground-secondary">
                    {o.property_count}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary">
                    {formatFeeConfig(
                      o.management_fee_type,
                      o.management_fee_percent,
                      o.management_fee_amount
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary">
                    {o.last_statement_period
                      ? monthLabel(o.last_statement_period.year, o.last_statement_period.month)
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {o.closing_balance_pence != null ? formatPence(o.closing_balance_pence) : "—"}
                  </td>
                  <td className="py-2.5 text-foreground-secondary whitespace-nowrap">
                    {o.contract_expiry_date ? formatDate(o.contract_expiry_date) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
