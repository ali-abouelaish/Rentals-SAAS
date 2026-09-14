import { AlertTriangle, Receipt } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getPlatformInvoices } from "@/features/admin/data/billing";
import { PlatformBillingManager } from "@/features/admin/ui/PlatformBillingManager";
import {
  billingPeriod,
  currentBillingPeriod,
  formatPeriod,
} from "@/lib/billing/rates";

/**
 * Period comes from the query string so the month is linkable and the back
 * button works. Anything unparseable falls back to the current month rather
 * than erroring — a mistyped URL should not be a dead end on a billing screen.
 */
function resolvePeriod(searchParams: { year?: string; month?: string }) {
  const year = Number(searchParams.year);
  const month = Number(searchParams.month);

  const valid =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 2024 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12;

  return valid ? billingPeriod(year, month) : currentBillingPeriod();
}

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const period = resolvePeriod(searchParams);
  const summary = await getPlatformInvoices(period);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing"
        subtitle="What Harbor Ops charges each agency: paid integrations and envelope top-ups, gathered into one invoice per agency per month."
      />

      {summary.unavailable && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  The invoice tables could not be read
                </p>
                <p className="text-foreground-secondary mt-1">
                  This is <strong>not</strong> the same as having nothing to bill. Apply{" "}
                  <code>20260913000001_platform_invoices.sql</code> and reload. Until then
                  no agency can be invoiced, and generating would fail.
                </p>
                {summary.error && (
                  <p className="text-foreground-muted mt-1 text-xs">{summary.error}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="h-4 w-4 text-brand" />
            <p className="text-sm font-medium text-foreground">
              Platform Invoices · {formatPeriod(period)}
            </p>
          </div>
          <p className="text-xs text-foreground-secondary mb-4">
            Drafts are generated automatically on the 1st and can be rebuilt any time.
            Issuing is what makes an invoice visible to the agency and stops it being
            regenerated — nothing is emailed and no payment is taken.
          </p>
          <PlatformBillingManager
            summary={summary}
            year={period.year}
            month={period.month}
            periodLabel={formatPeriod(period)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
