import { getIntegration, formatIntegrationPrice } from "@/lib/integrations/catalog";
import { IntegrationLogo } from "@/features/integrations/ui/IntegrationLogo";
import type {
  AdminEnvelopePurchase,
  AdminIntegrationSubscription,
} from "../domain/types";
import { formatPence } from "@/lib/envelopes/packs";

/**
 * What this tenant subscribes to, and what to put on their next invoice.
 *
 * Read-only. Activation is the agency's decision, made on their own
 * Integrations page; a super admin who needs to override does it through the
 * feature toggles below, which is the documented escape hatch for trials and
 * non-payment.
 */
export function TenantIntegrationsPanel({
  subscriptions,
  envelopePurchases = [],
}: {
  subscriptions: AdminIntegrationSubscription[];
  /**
   * One-off envelope top-ups. Separate from subscriptions because they are
   * one-time charges rather than recurring ones, and because an uninvoiced
   * purchase is money already spent by the agency that nobody has billed.
   */
  envelopePurchases?: AdminEnvelopePurchase[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  const billable = subscriptions.filter(
    (row) =>
      !row.is_grandfathered &&
      row.monthly_price_pence > 0 &&
      (row.status === "active" || row.status === "pending_setup") &&
      (!row.ends_on || row.ends_on >= today)
  );

  const monthlyTotal = billable.reduce((sum, row) => sum + row.monthly_price_pence, 0);

  const uninvoiced = envelopePurchases.filter((row) => !row.invoiced_at);
  const envelopeTotal = uninvoiced.reduce((sum, row) => sum + row.price_pence, 0);

  if (subscriptions.length === 0 && envelopePurchases.length === 0) {
    return (
      <p className="text-xs text-foreground-secondary">
        This agency hasn&apos;t activated any integrations. Paid features stay off
        until they do — or until you enable one below.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-surface-inset px-3 py-2 space-y-0.5">
        <p className="text-xs text-foreground-secondary">
          Add to next invoice:{" "}
          <span className="font-semibold text-foreground">
            {monthlyTotal + envelopeTotal > 0
              ? formatPence(monthlyTotal + envelopeTotal)
              : "nothing"}
          </span>
        </p>
        {(billable.length > 0 || uninvoiced.length > 0) && (
          <p className="text-[11px] text-foreground-muted">
            {billable.length > 0 && (
              <>
                {formatIntegrationPrice(monthlyTotal)} recurring ({billable.length}{" "}
                integration{billable.length === 1 ? "" : "s"})
              </>
            )}
            {billable.length > 0 && uninvoiced.length > 0 && " · "}
            {uninvoiced.length > 0 && (
              <>
                {formatPence(envelopeTotal)} one-off ({uninvoiced.length} envelope
                purchase{uninvoiced.length === 1 ? "" : "s"})
              </>
            )}
          </p>
        )}
      </div>

      {envelopePurchases.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-card p-3">
          <p className="text-xs font-medium text-foreground mb-2">Envelope top-ups</p>
          <div className="space-y-1">
            {envelopePurchases.slice(0, 8).map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
              >
                <span className="text-foreground-secondary">
                  {row.envelopes} envelopes · bought {formatDate(row.purchased_at.slice(0, 10))}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {formatPence(row.price_pence)}
                  </span>
                  <span
                    className={
                      row.invoiced_at ? "text-foreground-muted" : "text-amber-800 font-medium"
                    }
                  >
                    {row.invoiced_at
                      ? "invoiced"
                      : `bill ${formatDate(row.billing_period)}`}
                  </span>
                </span>
              </div>
            ))}
            {envelopePurchases.length > 8 && (
              <p className="text-[11px] text-foreground-muted pt-1">
                + {envelopePurchases.length - 8} older purchases
              </p>
            )}
          </div>
        </div>
      )}

      {subscriptions.map((row) => {
        const integration = getIntegration(row.integration_key);
        const lapsed = Boolean(row.ends_on && row.ends_on < today);
        return (
          <div
            key={row.integration_key}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface-card p-3"
          >
            <div className="flex min-w-0 items-start gap-3">
              {integration && <IntegrationLogo integration={integration} className="h-8 w-8" />}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {integration?.name ?? row.integration_key}
                </p>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  {row.status === "cancelled"
                    ? lapsed
                      ? `Ended ${formatDate(row.ends_on)}`
                      : `Cancelled — access until ${formatDate(row.ends_on)}`
                    : row.status === "pending_setup"
                      ? "Active, awaiting setup"
                      : "Active"}
                  {row.activated_at && ` · since ${formatDate(row.activated_at.slice(0, 10))}`}
                </p>
                {row.notes && (
                  <p className="text-[11px] text-foreground-muted mt-1 italic">{row.notes}</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-foreground">
                {row.is_grandfathered
                  ? "Free"
                  : formatIntegrationPrice(row.monthly_price_pence)}
              </p>
              <p className="text-[11px] text-foreground-muted">
                {row.is_grandfathered
                  ? "Grandfathered"
                  : row.billing_starts_on
                    ? `Bills from ${formatDate(row.billing_starts_on)}`
                    : "No charge"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
